/* Cours « L'invite de commandes & PowerShell » : domaines d'emploi + commandes les plus utilisées.
   Crée la page + reconstruit le hub (source de vérité : ./_hub.ts).
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cmd-powershell.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
import { buildHubBlocks } from './_hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const SLUG = 'cmd-et-powershell';
const TITLE = 'L’invite de commandes & PowerShell';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const accordion = (it: Array<[string, string]>) => block('accordion', { items: it.map(([title, text]) => ({ title, text, href: '' })) });
const ul = (items: string[]) => `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
const code = (lines: string[]) => `<pre style="background:var(--surface-2);border:1px solid var(--border);padding:10px 12px;border-radius:8px;overflow:auto;font-size:13px;line-height:1.55;margin:8px 0"><code>${lines.join('\n')}</code></pre>`;
const table = (head: string[], rows: string[][]) =>
  `<table class="wp-list"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`
  + rows.map(r => `<tr>${r.map((c, i) => `<td${i === 0 ? ' class="column-primary"' : ''} data-label="${head[i]}">${c}</td>`).join('')}</tr>`).join('')
  + '</tbody></table>';

// ===== Schéma SVG : le pipeline PowerShell =====
const svgPipe = (() => {
  const box = (x: number, w: number, f: string, l: string, s: string) =>
    `<rect x="${x}" y="26" width="${w}" height="46" rx="8" fill="${f}"/><text x="${x + w / 2}" y="46" text-anchor="middle" font-size="12" fill="#fff" font-weight="bold">${l}</text><text x="${x + w / 2}" y="62" text-anchor="middle" font-size="10" fill="#e5e7eb">${s}</text>`;
  const pipe = (x: number) => `<text x="${x}" y="56" text-anchor="middle" font-size="22" fill="#64748b" font-weight="bold">|</text>`;
  return `<svg viewBox="0 0 460 96" role="img" style="max-width:460px;width:100%;height:auto;margin:6px 0 12px;font-family:system-ui,sans-serif">`
    + box(8, 120, '#2563eb', 'Get-Process', 'produire des objets') + pipe(140)
    + box(156, 120, '#7c3aed', 'Where-Object', 'filtrer') + pipe(288)
    + box(304, 120, '#16a34a', 'Stop-Process', 'agir')
    + `<text x="230" y="90" text-anchor="middle" font-size="11" fill="#64748b">Le « | » passe des OBJETS d’une commande à la suivante</text></svg>`;
})();

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Software', title: TITLE, subtitle: 'Parler à Windows en texte : à quoi servent CMD et PowerShell, et les commandes à connaître.' }),
  block('html', { html: '<p>Une <strong>ligne de commande</strong> (CLI, <em>Command-Line Interface</em>) permet de <strong>piloter l’ordinateur en tapant des commandes</strong>, au lieu de cliquer dans des fenêtres. Windows en propose deux : l’<strong>invite de commandes</strong> (CMD) et <strong>PowerShell</strong>. C’est plus rapide pour beaucoup de tâches, ça s’<strong>automatise</strong> (scripts), et c’est indispensable pour l’administration et le dépannage.</p>' }),
  note('blue', '🔎 Analogie', '<p>L’interface graphique, c’est <strong>commander au serveur en pointant le menu du doigt</strong>. La ligne de commande, c’est <strong>dicter précisément ta commande</strong> : plus direct, reproductible, et on peut écrire la « recette » une fois pour la rejouer (script).</p>'),

  block('heading', { level: 2, text: 'Comment les ouvrir' }),
  block('html', { html: ul([
    '<strong>Exécuter</strong> (<kbd>Win</kbd>+<kbd>R</kbd>) puis <code>cmd</code> ou <code>powershell</code>.',
    'Menu Démarrer → taper « Invite de commandes » ou « PowerShell ».',
    '<strong>En administrateur</strong> : clic droit → « Exécuter en tant qu’administrateur » (indispensable pour les commandes système).',
    'Outil moderne : <strong>Windows Terminal</strong>, qui regroupe CMD, PowerShell et WSL dans des onglets.',
  ]) }),

  block('heading', { level: 2, text: 'CMD ou PowerShell ? Domaines d’emploi' }),
  accordion([
    ['🖥️ CMD — l’invite de commandes (cmd.exe)', `<p>La <strong>console historique</strong> de Windows, héritée de MS-DOS. Elle manipule du <strong>texte</strong> et reste <strong>simple et rapide</strong> pour des commandes ponctuelles.</p>${ul(['Idéale pour les <strong>commandes réseau/diagnostic</strong> classiques (<code>ipconfig</code>, <code>ping</code>…).', 'Scripts <strong>.bat / .cmd</strong> (automatisation simple).', 'Compatibilité avec d’anciens outils et habitudes.'])}<p><strong>Limite :</strong> peu adaptée aux tâches d’administration complexes.</p>`],
    ['⚡ PowerShell — le moderne et puissant', `<p>Console <strong>moderne orientée objets</strong> : les commandes (<strong>cmdlets</strong>) suivent la forme <strong>Verbe-Nom</strong> (<code>Get-Process</code>, <code>Stop-Service</code>…) et s’échangent des <strong>objets</strong>, pas seulement du texte.</p>${ul(['<strong>Automatisation et administration</strong> (postes, serveurs, Active Directory, cloud).', 'Scripts <strong>.ps1</strong> riches, accès à tout le framework <strong>.NET</strong>.', '<strong>Gestion à distance</strong> de plusieurs machines.', 'Un <strong>pipeline</strong> très puissant (voir plus bas).'])}<p><strong>En clair :</strong> CMD pour une commande rapide ou héritée ; <strong>PowerShell</strong> dès qu’on automatise ou qu’on administre sérieusement.</p>`],
    ['🔁 Bonne nouvelle : des alias familiers', `<p>PowerShell accepte des <strong>alias</strong> qui ressemblent à CMD/Linux, pour ne pas être perdu :</p>${table(['Alias', 'Vraie cmdlet', 'Rôle'], [['<code>ls</code> / <code>dir</code>', 'Get-ChildItem', 'Lister'], ['<code>cd</code>', 'Set-Location', 'Se déplacer'], ['<code>cat</code> / <code>type</code>', 'Get-Content', 'Afficher un fichier'], ['<code>cp</code>', 'Copy-Item', 'Copier'], ['<code>rm</code> / <code>del</code>', 'Remove-Item', 'Supprimer'], ['<code>ps</code>', 'Get-Process', 'Lister les processus']])}`],
  ]),

  block('heading', { level: 2, text: 'Les bases à connaître' }),
  block('html', { html: ul([
    '<strong>Se repérer</strong> : le « chemin » courant s’affiche (ex. <code>C:\\Users\\Tech&gt;</code>). On se déplace avec <code>cd</code>.',
    '<strong>Autocomplétion</strong> : la touche <kbd>Tab</kbd> complète les noms de fichiers/commandes.',
    '<strong>Historique</strong> : les flèches <kbd>↑</kbd>/<kbd>↓</kbd> rappellent les commandes précédentes.',
    '<strong>Aide</strong> : <code>help</code> ou <code>&lt;commande&gt; /?</code> (CMD) ; <code>Get-Help &lt;cmdlet&gt;</code> (PowerShell).',
    '<strong>Stopper</strong> une commande : <kbd>Ctrl</kbd>+<kbd>C</kbd>. <strong>Effacer</strong> l’écran : <code>cls</code> / <code>Clear-Host</code>.',
  ]) }),

  block('heading', { level: 2, text: 'Commandes les plus utilisées' }),
  block('html', { html: '<h3>📁 Naviguer & gérer les fichiers (CMD)</h3>' + table(['Commande', 'Rôle'], [
    ['<code>cd</code> / <code>cd ..</code>', 'Changer de dossier / remonter'],
    ['<code>dir</code>', 'Lister le contenu du dossier'],
    ['<code>cls</code>', 'Effacer l’écran'],
    ['<code>md</code> / <code>mkdir</code>', 'Créer un dossier'],
    ['<code>rd</code> / <code>rmdir</code>', 'Supprimer un dossier'],
    ['<code>del</code>', 'Supprimer un fichier'],
    ['<code>copy</code> / <code>move</code>', 'Copier / déplacer'],
    ['<code>ren</code>', 'Renommer'],
    ['<code>type</code>', 'Afficher le contenu d’un fichier'],
    ['<code>tree</code>', 'Arborescence des dossiers'],
  ]) }),
  block('html', { html: '<h3>🌐 Système & réseau (CMD)</h3>' + table(['Commande', 'Rôle'], [
    ['<code>ipconfig /all</code>', 'Voir la configuration réseau (IP, DNS…)'],
    ['<code>ping &lt;hôte&gt;</code>', 'Tester si une machine répond'],
    ['<code>tracert &lt;hôte&gt;</code>', 'Suivre le chemin réseau jusqu’à une cible'],
    ['<code>nslookup &lt;nom&gt;</code>', 'Interroger le DNS (nom ↔ IP)'],
    ['<code>netstat -ano</code>', 'Connexions réseau et ports ouverts'],
    ['<code>tasklist</code> / <code>taskkill /PID</code>', 'Lister / tuer un processus'],
    ['<code>systeminfo</code>', 'Infos détaillées sur la machine'],
    ['<code>sfc /scannow</code>', 'Vérifier/réparer les fichiers système'],
    ['<code>chkdsk</code>', 'Vérifier le disque'],
    ['<code>gpupdate /force</code>', 'Réappliquer les stratégies de groupe'],
    ['<code>shutdown /r /t 0</code>', 'Redémarrer immédiatement'],
  ]) }),
  block('html', { html: '<h3>⚡ Cmdlets PowerShell essentielles</h3>' + table(['Cmdlet', 'Rôle'], [
    ['<code>Get-Command</code>', 'Lister/chercher les commandes disponibles'],
    ['<code>Get-Help &lt;cmdlet&gt;</code>', 'Aide détaillée (ajouter <code>-Examples</code>)'],
    ['<code>Get-ChildItem</code>', 'Lister fichiers et dossiers'],
    ['<code>Get-Content</code>', 'Lire un fichier'],
    ['<code>Get-Process</code> / <code>Stop-Process</code>', 'Lister / arrêter des processus'],
    ['<code>Get-Service</code> / <code>Restart-Service</code>', 'Gérer les services'],
    ['<code>Test-Connection</code>', 'Équivalent de ping (objets)'],
    ['<code>Get-NetIPConfiguration</code>', 'Configuration réseau'],
    ['<code>Where-Object</code> / <code>Select-Object</code>', 'Filtrer / choisir des propriétés'],
    ['<code>ForEach-Object</code>', 'Agir sur chaque élément'],
    ['<code>Get-WindowsFeature</code>', 'Rôles/fonctionnalités (Windows Server)'],
  ]) }),

  block('heading', { level: 2, text: 'Le super-pouvoir de PowerShell : le pipeline' }),
  block('html', { html: svgPipe }),
  block('html', { html: `<p>Le caractère <strong>« | » (pipe)</strong> envoie le <strong>résultat</strong> d’une commande dans la suivante. Là où CMD passe du <strong>texte</strong>, PowerShell passe des <strong>objets</strong> (avec leurs propriétés), ce qui rend les enchaînements très puissants :</p>${code(['# Arrêter les processus qui consomment beaucoup de CPU', 'Get-Process | Where-Object { $_.CPU -gt 100 } | Stop-Process', '', '# Les 5 plus gros fichiers du dossier, triés', 'Get-ChildItem | Sort-Object Length -Descending | Select-Object -First 5'])}` }),

  block('heading', { level: 2, text: 'Exécuter un script PowerShell (.ps1)' }),
  block('html', { html: `<p>Par sécurité, Windows bloque par défaut l’exécution des scripts. Pour l’autoriser (en administrateur) :</p>${code(['Set-ExecutionPolicy RemoteSigned', '', '# Lancer un script', '.\\mon-script.ps1'])}` }),
  note('yellow', '⚠️ Prudence', '<p>Une commande en ligne s’exécute <strong>sans confirmation</strong> et peut être <strong>destructrice</strong> (ex. <code>del</code>, <code>Remove-Item</code>, <code>format</code>). Vérifie le <strong>dossier courant</strong>, lis deux fois avant <kbd>Entrée</kbd>, et méfie-toi des commandes copiées sans les comprendre. Les commandes système exigent souvent une console <strong>administrateur</strong>.</p>'),
  note('green', '💡 À retenir', '<p><strong>CMD</strong> = rapide, héritée, commandes texte (réseau/diagnostic, scripts .bat). <strong>PowerShell</strong> = moderne, orientée <strong>objets</strong>, pour <strong>automatiser et administrer</strong> (cmdlets <em>Verbe-Nom</em>, pipeline, scripts .ps1). Réflexes : <kbd>Tab</kbd> (complétion), <kbd>↑</kbd> (historique), <code>Get-Help</code> / <code>/?</code> (aide). Termes (CLI, cmdlet, pipeline…) dans le <a href="/glossaire">Glossaire</a>.</p>'),
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
  const cur = existing.find(e => e.slug === SLUG);
  const bodyJson = JSON.stringify({ title: TITLE, slug: SLUG, excerpt: 'CMD et PowerShell : domaines d’emploi et commandes les plus utilisées (réseau, fichiers, système, pipeline).', content: renderPageBlocksToHtml(blocks), builder_json: serializePageBlocks(blocks), published: 1 });
  const res = cur
    ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body: bodyJson })
    : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body: bodyJson });
  console.log('PAGE', res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());

  const cours = existing.find(e => e.slug === 'cours');
  if (cours) {
    const hub = buildHubBlocks();
    const r2 = await fetch(`${BASE}/api/admin/pages/${cours.id}`, { method: 'PUT', headers: h, body: JSON.stringify({ title: 'Cours', slug: 'cours', content: renderPageBlocksToHtml(hub), builder_json: serializePageBlocks(hub), published: 1 }) });
    console.log('HUB Cours', r2.status, r2.ok ? '(maj)' : await r2.text());
  }
  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

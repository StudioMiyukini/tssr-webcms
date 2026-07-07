/* Procédure « Sauvegarde & restauration (stratégie 3-2-1, Windows Server Backup) ».
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-procedure-sauvegarde.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = { slug: 'procedure-sauvegarde', title: 'Sauvegarde & restauration des données', excerpt: 'Bâtir une vraie stratégie de sauvegarde : règle 3-2-1, types (complète / incrémentale / différentielle), planification et test de restauration. Mise en œuvre avec Windows Server Backup (données) et rappel des outils (Veeam).' };
const block = (t: Parameters<typeof makePageBlock>[0], p: Partial<PageBlock>) => Object.assign(makePageBlock(t), p);
const note = (c: string, t: string, h: string) => block('html', { html: `<aside class="pb-note pb-note-${c}"><p class="pb-note-title">${t}</p>${h}</aside>` });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stepsStyle = block('html', { html: `<style>.proc-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.55}.sv-t{border-collapse:collapse;width:100%;font-size:13px;margin:6px 0}.sv-t th,.sv-t td{border:1px solid var(--border);padding:7px 10px;text-align:left}.sv-t th{background:var(--surface-2)}</style>` });
const cmd = (t: string) => block('html', { html: `<div class="proc-cmd">${esc(t)}</div>` });
const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Procédure · Exploitation', title: PAGE.title, subtitle: 'Une sauvegarde non testée n’est pas une sauvegarde.' }),
  stepsStyle,
  note('blue', '🎯 La règle 3-2-1', '<p><strong>3</strong> copies des données · sur <strong>2</strong> supports différents · dont <strong>1</strong> hors site (externalisée). C’est la base de toute stratégie de sauvegarde : elle protège à la fois de la panne matérielle, de l’erreur humaine, du ransomware et du sinistre (incendie, vol).</p>'),
  block('heading', { level: 2, text: '1) Les types de sauvegarde' }),
  block('html', { html: `<table class="sv-t"><thead><tr><th>Type</th><th>Ce qu’elle copie</th><th>Restauration</th></tr></thead><tbody>
    <tr><td><strong>Complète</strong></td><td>toutes les données à chaque fois</td><td>simple (1 jeu), mais lourde/longue</td></tr>
    <tr><td><strong>Incrémentale</strong></td><td>ce qui a changé depuis la <em>dernière sauvegarde</em> (quelconque)</td><td>rapide à sauver, restauration = complète + <strong>toutes</strong> les incrémentales</td></tr>
    <tr><td><strong>Différentielle</strong></td><td>ce qui a changé depuis la dernière <em>complète</em></td><td>compromis : complète + <strong>la dernière</strong> différentielle</td></tr>
  </tbody></table>` }),
  note('gray', '🗓️ Schéma courant', '<p>Une <strong>complète</strong> le week-end + une <strong>incrémentale (ou différentielle)</strong> chaque nuit. On définit aussi une <strong>rétention</strong> (combien de temps on garde) et une <strong>rotation</strong> des supports (ex. GFS : Grand-père / Père / Fils).</p>'),
  block('heading', { level: 2, text: '2) Windows Server Backup (données)' }),
  block('html', { html: '<p>Installer la fonctionnalité, puis planifier une sauvegarde vers un <strong>volume dédié</strong> ou un <strong>partage réseau</strong>.</p>' }),
  cmd(`Install-WindowsFeature Windows-Server-Backup -IncludeManagementTools`),
  block('html', { html: '<p>En GUI (<code>wbadmin.msc</code>) : <em>Planification de sauvegarde</em> → choisir les volumes/dossiers → destination → fréquence. En ligne de commande, sauvegarde ponctuelle d’un volume :</p>' }),
  cmd(`wbadmin start backup -backupTarget:E: -include:D: -quiet`),
  note('yellow', '⚠️ Où stocker', '<p>Jamais sur le <strong>même disque</strong> que les données. Idéalement un disque externe/rotatif <strong>+</strong> une copie <strong>hors site</strong> (NAS distant, cloud). Pour l’état système d’un DC, voir <a href="/pages/procedure-sauvegarde-ad">Sauvegarde & restauration AD</a>.</p>'),
  block('heading', { level: 2, text: '3) Restaurer (et TESTER)' }),
  block('html', { html: '<p>La restauration se fait depuis <code>wbadmin.msc</code> → <em>Récupérer</em> → choisir la date → fichiers/volume → destination. <strong>Teste régulièrement</strong> une restauration réelle sur un emplacement de test : c’est le seul moyen de garantir que les sauvegardes sont exploitables.</p>' }),
  cmd(`wbadmin get versions           # lister les sauvegardes disponibles`),
  block('heading', { level: 2, text: '4) Aller plus loin' }),
  block('html', { html: '<p>En entreprise, on utilise des solutions dédiées comme <strong>Veeam Backup &amp; Replication</strong> (sauvegarde de VM, restauration granulaire, réplication), ou l’équivalent Linux (<code>rsync</code>, <code>Bacula</code>, <code>Borg</code>). Le principe reste le même : <strong>3-2-1</strong>, planification, rétention, <strong>test</strong>.</p>' }),
  note('green', '🔗 Liens', '<p><a href="/pages/procedure-sauvegarde-ad">Sauvegarde AD (état système)</a> · <a href="/pages/procedure-dfs">DFS (redondance fichiers)</a> · <a href="/pages/procedure-gestion-disques">Gestion des disques</a>.</p>'),
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

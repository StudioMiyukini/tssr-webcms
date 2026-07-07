/* Procédure « DFS : espace de noms (DFS-N) + réplication (DFS-R) » : installer le rôle,
   créer un espace de noms de domaine, ajouter dossiers/cibles (redondance), configurer DFS-R, vérifier.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-procedure-dfs.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = { slug: 'procedure-dfs', title: 'DFS : espace de noms (DFS-N) + réplication (DFS-R)', excerpt: 'Unifier les partages sous un chemin unique \\\\domaine\\Partages (espace de noms DFS) et répliquer les données entre serveurs pour la redondance et la proximité (DFS-R). Rôle Services de fichiers, cibles multiples, topologie de réplication, tests.' };
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stepsStyle = block('html', { html: `<style>.proc-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.55}</style>` });
const cmd = (t: string) => block('html', { html: `<div class="proc-cmd">${esc(t)}</div>` });

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Procédure · Hébergement / Fichiers', title: PAGE.title, subtitle: 'Un chemin unique pour tous les partages, et des données répliquées entre serveurs.' }),
  stepsStyle,
  note('blue', '🎯 À quoi sert DFS', '<p><strong>DFS-N (espace de noms)</strong> présente plusieurs partages, éparpillés sur différents serveurs, sous un <strong>chemin unique et stable</strong> : <code>\\\\miyukini.lan\\Partages</code>. <strong>DFS-R (réplication)</strong> synchronise le contenu de dossiers entre serveurs → <strong>redondance</strong> (si un serveur tombe, les clients basculent) et <strong>proximité</strong> (accès au serveur le plus proche).</p>'),

  block('heading', { level: 2, text: '1) Installer le rôle (Services de fichiers)' }),
  block('html', { html: '<p>Gestionnaire de serveur → Ajouter des rôles → <strong>Services de fichiers et de stockage</strong> → <strong>Espaces de noms DFS</strong> et <strong>Réplication DFS</strong>. En PowerShell :</p>' }),
  cmd(`Install-WindowsFeature FS-DFS-Namespace,FS-DFS-Replication -IncludeManagementTools`),

  block('heading', { level: 2, text: '2) Créer un espace de noms (DFS-N)' }),
  block('html', { html: '<p>Outil <strong>Gestion du système de fichiers DFS</strong> (<code>dfsmgmt.msc</code>) → Nouvel espace de noms → serveur hôte → nom (ex. <code>Partages</code>) → type <strong>« basé sur un domaine »</strong> (chemin <code>\\\\miyukini.lan\\Partages</code>, tolérant aux pannes). En PowerShell :</p>' }),
  cmd(`New-DfsnRoot -TargetPath "\\\\SRV1\\Partages" -Type DomainV2 -Path "\\\\miyukini.lan\\Partages"`),
  note('gray', '💡 Domaine vs autonome', '<p><strong>Basé sur un domaine</strong> : le chemin utilise le nom de domaine, plusieurs serveurs de noms possibles (redondant). <strong>Autonome</strong> : chemin en <code>\\\\SERVEUR\\...</code> (pas de redondance de l’espace de noms). En entreprise, on prend le mode domaine.</p>'),

  block('heading', { level: 2, text: '3) Ajouter des dossiers et des cibles' }),
  block('html', { html: '<p>Dans l’espace de noms, ajoute un <strong>dossier</strong> (lien logique, ex. <code>Compta</code>) pointant vers une <strong>cible</strong> = un partage réel existant. Pour la <strong>redondance</strong>, ajoute <strong>plusieurs cibles</strong> au même dossier (le même contenu sur 2 serveurs) :</p>' }),
  cmd(`New-DfsnFolder -Path "\\\\miyukini.lan\\Partages\\Compta" -TargetPath "\\\\SRV1\\Compta$"
Add-DfsnFolderTarget -Path "\\\\miyukini.lan\\Partages\\Compta" -TargetPath "\\\\SRV2\\Compta$"`),
  block('html', { html: '<p>Les clients accèdent à <code>\\\\miyukini.lan\\Partages\\Compta</code> et sont dirigés (referral) vers une cible disponible.</p>' }),

  block('heading', { level: 2, text: '4) Configurer la réplication (DFS-R)' }),
  block('html', { html: '<p>Pour que les cibles multiples aient le <strong>même contenu</strong>, crée un <strong>groupe de réplication</strong> : dfsmgmt → Réplication → Nouveau groupe de réplication → ajouter les serveurs membres (SRV1, SRV2), choisir le <strong>dossier répliqué</strong>, le <strong>membre principal</strong> (source initiale), la <strong>topologie</strong> (maille pleine pour 2-3 serveurs) et la <strong>planification/bande passante</strong>. En PowerShell :</p>' }),
  cmd(`New-DfsReplicationGroup -GroupName "RG-Compta"
New-DfsReplicatedFolder -GroupName "RG-Compta" -FolderName "Compta"
Add-DfsrMember -GroupName "RG-Compta" -ComputerName SRV1,SRV2
Add-DfsrConnection -GroupName "RG-Compta" -SourceComputerName SRV1 -DestinationComputerName SRV2
Set-DfsrMembership -GroupName "RG-Compta" -FolderName "Compta" -ComputerName SRV1 -ContentPath "D:\\Compta" -PrimaryMember $true
Set-DfsrMembership -GroupName "RG-Compta" -FolderName "Compta" -ComputerName SRV2 -ContentPath "D:\\Compta"`),
  note('yellow', '⚠️ Membre principal', '<p>Le <strong>membre principal</strong> n’a de sens qu’à la <strong>première</strong> synchronisation (il fait référence). Après convergence, la réplication est <strong>multi-maître</strong> (modifs dans les deux sens). Ne désigne un principal que sur le serveur qui contient déjà les données.</p>'),

  block('heading', { level: 2, text: '5) Vérifier' }),
  cmd(`Get-DfsnFolderTarget "\\\\miyukini.lan\\Partages\\Compta"
Get-DfsrState -ComputerName SRV2
dfsrdiag ReplicationState`),
  block('html', { html: '<p><strong>Tests</strong> : ouvre <code>\\\\miyukini.lan\\Partages</code> depuis un client ; crée un fichier dans une cible → il doit apparaître dans l’autre (réplication). <strong>Bascule</strong> : arrête SRV1, l’accès au dossier continue via SRV2.</p>' }),

  note('gray', '🔐 Permissions', '<p>DFS ne gère <strong>pas</strong> les droits : ce sont les permissions <strong>Partage + NTFS</strong> des cibles qui s’appliquent (les mêmes sur toutes les cibles). Voir <a href="/pages/permissions-partage-ntfs">Permissions : Partage & NTFS</a> et <a href="/pages/procedure-agdlp">AGDLP</a>.</p>'),
  note('green', '✅ Justification', '<p>Rôle installé, espace de noms de domaine, dossiers à cibles multiples et groupe de réplication : tu as mis en place un partage <strong>unifié et redondant</strong>, à présenter comme solution de haute disponibilité fichiers.</p>'),
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

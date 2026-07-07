/* Procédure « Sauvegarde & restauration d'Active Directory » : Windows Server Backup (état système),
   corbeille AD (restaurer un objet supprimé), restauration faisant autorité (DSRM / ntdsutil).
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-procedure-sauvegarde-ad.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = { slug: 'procedure-sauvegarde-ad', title: 'Sauvegarde & restauration d’Active Directory', excerpt: 'Protéger le cœur du domaine : sauvegarde de l’état système (Windows Server Backup), corbeille AD pour restaurer un objet supprimé, et restauration faisant autorité d’un contrôleur (DSRM / ntdsutil).' };
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stepsStyle = block('html', { html: `<style>.proc-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.55}</style>` });
const cmd = (t: string) => block('html', { html: `<div class="proc-cmd">${esc(t)}</div>` });

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Procédure · Active Directory', title: PAGE.title, subtitle: 'Sauvegarder l’annuaire et savoir revenir en arrière : objet supprimé, ou contrôleur entier.' }),
  stepsStyle,
  note('blue', '🎯 Pourquoi & quoi sauvegarder', '<p>Active Directory est le <strong>cœur du SI</strong> : sa perte bloque connexions, DNS et accès. On sauvegarde l’<strong>état système</strong> (System State) d’au moins un contrôleur de domaine — il contient <strong>AD DS (NTDS)</strong>, <strong>SYSVOL</strong>, le <strong>registre</strong> et la base de certificats. Prérequis : un DC opérationnel (voir <a href="/pages/procedure-installation-active-directory">Installer AD</a>).</p>'),
  note('gray', '🧭 Trois scénarios de restauration', '<p><strong>1.</strong> Un <em>objet</em> supprimé par erreur → <strong>corbeille AD</strong> (rapide, sans redémarrage). <strong>2.</strong> Des objets à <em>réimposer</em> aux autres DC → restauration <strong>faisant autorité</strong> (DSRM + ntdsutil). <strong>3.</strong> Un <em>DC détruit</em> → restauration de l’état système (ou re-promotion d’un nouveau DC si un autre DC survit).</p>'),

  block('heading', { level: 2, text: '1) Installer Windows Server Backup' }),
  cmd(`Install-WindowsFeature Windows-Server-Backup -IncludeManagementTools`),

  block('heading', { level: 2, text: '2) Sauvegarder l’état système' }),
  block('html', { html: '<p><strong>GUI</strong> : <em>wbadmin.msc</em> → Sauvegarde unique → Personnalisé → cocher <strong>État du système</strong> → destination (volume dédié ou partage). <strong>Ligne de commande</strong> (destination sur E:) :</p>' }),
  cmd(`wbadmin start systemstatebackup -backupTarget:E: -quiet`),
  note('yellow', '⚠️ Bonnes pratiques', '<ul><li>Destination <strong>autre que le disque système</strong> (idéalement hors machine).</li><li>Sauvegarde <strong>régulière</strong> et <strong>récente</strong> : une sauvegarde AD est valable au maximum jusqu’à la <em>tombstone lifetime</em> (180 jours par défaut) — au-delà elle est refusée.</li><li>Teste la restauration au moins une fois : une sauvegarde non testée n’en est pas une.</li></ul>'),

  block('heading', { level: 2, text: '3) Activer la corbeille Active Directory' }),
  block('html', { html: '<p>La <strong>corbeille AD</strong> permet de restaurer un objet supprimé <strong>avec tous ses attributs</strong> (groupes, etc.), sans redémarrer. Prérequis : niveau fonctionnel de forêt <strong>2008 R2 ou supérieur</strong>. <strong>Attention : l’activation est définitive</strong> (irréversible).</p>' }),
  cmd(`Enable-ADOptionalFeature 'Recycle Bin Feature' \`
  -Scope ForestOrConfigurationSet -Target "miyukini.lan"`),
  block('html', { html: '<p>(En GUI : <em>Centre d’administration Active Directory</em> → domaine → <strong>Activer la corbeille</strong>.)</p>' }),

  block('heading', { level: 2, text: '4) Restaurer un objet supprimé (corbeille)' }),
  block('html', { html: '<p><strong>GUI</strong> : Centre d’administration AD → conteneur <strong>Deleted Objects</strong> → clic droit sur l’objet → <strong>Restaurer</strong> (ou « Restaurer vers… » pour choisir l’UO). <strong>PowerShell</strong> :</p>' }),
  cmd(`# retrouver l'objet supprimé
Get-ADObject -Filter 'Name -like "*Jean*"' -IncludeDeletedObjects
# le restaurer
Get-ADObject -Filter 'SamAccountName -eq "jean.nguyen"' -IncludeDeletedObjects |
  Restore-ADObject`),

  block('heading', { level: 2, text: '5) Restauration faisant autorité (DSRM)' }),
  block('html', { html: '<p>Quand des objets doivent être <strong>réimposés à tous les DC</strong> (sinon la réplication les re-supprimerait), on passe par le <strong>mode restauration des services d’annuaire (DSRM)</strong>.</p>' }),
  block('list', { listItems: [
    'Redémarrer le DC en DSRM : msconfig → Démarrage sécurisé → Réparation Active Directory (ou bcdedit /set safeboot dsrepair puis redémarrer). Ouvrir la session avec le compte DSRM (défini à la promotion du DC).',
    'Restaurer l’état système depuis la sauvegarde (Windows Server Backup / wbadmin get versions puis start systemstaterecovery).',
    'Marquer comme « faisant autorité » les objets/UO à réimposer avec ntdsutil (ci-dessous).',
    'Redémarrer normalement (bcdedit /deletevalue safeboot) : les objets restaurés se répliquent vers les autres DC.',
  ] }),
  cmd(`ntdsutil
activate instance ntds
authoritative restore
restore subtree "OU=Bureaux,DC=miyukini,DC=lan"
quit
quit`),
  note('yellow', '⚠️ Autoritaire ou pas ?', '<p>Une restauration <strong>non autoritaire</strong> (par défaut) laisse les autres DC « corriger » le DC restauré par réplication — utile pour remettre un DC en service. Une restauration <strong>autoritaire</strong> (ntdsutil) <strong>force</strong> la version restaurée à gagner et à se propager — c’est ce qu’il faut pour <strong>ressusciter des objets</strong> supprimés partout.</p>'),

  block('heading', { level: 2, text: '6) Vérifier' }),
  cmd(`Get-ADUser jean.nguyen
wbadmin get versions
repadmin /replsummary
dcdiag`),
  block('html', { html: '<p>Confirme que l’objet est revenu (attributs et appartenances), que la sauvegarde est listée, et que la réplication entre DC est saine.</p>' }),

  note('green', '✅ Justification', '<p>Sauvegarde de l’état système, corbeille AD pour un objet, et restauration autoritaire d’un DC : tu couvres les trois cas d’examen. À combiner avec la <a href="/pages/procedure-dns-redondance">redondance DNS</a> et un <strong>2e contrôleur de domaine</strong> pour éviter d’avoir à restaurer. Gestion des objets : <a href="/pages/procedure-ad-objets">AD : UO, groupes & utilisateurs</a>.</p>'),
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

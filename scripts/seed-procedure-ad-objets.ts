/* Procédure « Active Directory : créer UO, groupes et utilisateurs (unitaire & en masse) » :
   dsa.msc + PowerShell (New-ADOrganizationalUnit / New-ADGroup / New-ADUser / import CSV / copie).
   Justifie manuellement les constructeurs AD (masse, copie d'utilisateur).
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-procedure-ad-objets.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = { slug: 'procedure-ad-objets', title: 'Active Directory : UO, groupes et utilisateurs (unitaire & en masse)', excerpt: 'Créer et gérer les objets AD : unités d’organisation, groupes (portée/type), utilisateurs à l’unité, copie d’un compte modèle et création en masse par CSV. Console dsa.msc et PowerShell (module ActiveDirectory). Procédure manuelle des constructeurs AD.' };
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stepsStyle = block('html', { html: `<style>.proc-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.55}</style>` });
const cmd = (t: string) => block('html', { html: `<div class="proc-cmd">${esc(t)}</div>` });

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Procédure · Active Directory', title: PAGE.title, subtitle: 'Ce que produisent les constructeurs AD, refait à la main : console et PowerShell.' }),
  stepsStyle,
  note('blue', '🎯 Objectif & prérequis', '<p>Créer les <strong>unités d’organisation</strong>, <strong>groupes</strong> et <strong>utilisateurs</strong> d’un domaine, à l’unité ou <strong>en masse</strong>. Prérequis : le rôle <strong>AD DS</strong> est installé et le serveur est contrôleur de domaine (voir <a href="/pages/procedure-installation-active-directory">Installer & configurer Active Directory</a>). Cette procédure <strong>justifie</strong> les outils <a href="/pages/constructeur-ad">Constructeur AD (masse)</a> et <a href="/pages/configurateur-ad">Configurateur — Active Directory</a>.</p>'),
  note('gray', '🧰 Deux voies', '<p><strong>Graphique</strong> : <em>Utilisateurs et ordinateurs Active Directory</em> (<code>dsa.msc</code>). <strong>PowerShell</strong> : module <code>ActiveDirectory</code> (à exécuter sur le DC, session administrateur). Les deux donnent le même résultat ; PowerShell est indispensable pour la masse.</p>'),

  block('heading', { level: 2, text: '1) Créer une unité d’organisation (UO)' }),
  block('html', { html: '<p><strong>GUI</strong> : clic droit sur le domaine → Nouveau → Unité d’organisation → nommer (ex. <code>Bureaux</code>). Garde « Protéger contre une suppression accidentelle ». <strong>PowerShell</strong> :</p>' }),
  cmd(`New-ADOrganizationalUnit -Name "Bureaux" -Path "DC=miyukini,DC=lan" -ProtectedFromAccidentalDeletion $true`),
  block('html', { html: '<p>Les UO structurent le domaine et servent de cible aux <strong>GPO</strong> et à la délégation.</p>' }),

  block('heading', { level: 2, text: '2) Créer un groupe' }),
  block('html', { html: '<p>Choisir la <strong>portée</strong> (Global / Domaine local / Universel) et le <strong>type</strong> (Sécurité pour les droits, Distribution pour les listes de diffusion). <strong>GUI</strong> : clic droit sur l’UO → Nouveau → Groupe. <strong>PowerShell</strong> :</p>' }),
  cmd(`New-ADGroup -Name "G_Bureaux" -GroupScope Global -GroupCategory Security -Path "OU=Bureaux,DC=miyukini,DC=lan"`),
  note('yellow', '⚠️ Convention AGDLP', '<p>Groupe <strong>Global</strong> = regroupe les <em>comptes</em> par métier (<code>G_*</code>) ; groupe <strong>Domaine local</strong> = porte les <em>permissions</em> sur une ressource (<code>DL_*</code>). On imbrique G dans DL. Détail : <a href="/pages/procedure-agdlp">Mettre en place AGDLP</a>.</p>'),

  block('heading', { level: 2, text: '3) Créer un utilisateur (à l’unité)' }),
  block('html', { html: '<p><strong>GUI</strong> : clic droit sur l’UO → Nouveau → Utilisateur → prénom/nom, <strong>nom d’ouverture de session</strong> (UPN <code>prenom.nom@miyukini.lan</code>), mot de passe + « changement à la première connexion ». <strong>PowerShell</strong> :</p>' }),
  cmd(`New-ADUser -Name "Jean NGUYEN" -GivenName "Jean" -Surname "NGUYEN" \`
  -SamAccountName "jean.nguyen" -UserPrincipalName "jean.nguyen@miyukini.lan" \`
  -Path "OU=Bureaux,DC=miyukini,DC=lan" \`
  -AccountPassword (Read-Host -AsSecureString "Mot de passe initial") \`
  -ChangePasswordAtLogon $true -Enabled $true`),

  block('heading', { level: 2, text: '4) Copier un utilisateur modèle' }),
  block('html', { html: '<p>Pour créer un compte identique à un modèle (mêmes groupes/UO) — ce que fait le <a href="/pages/configurateur-ad">configurateur AD</a>. <strong>GUI</strong> : clic droit sur le compte modèle → <em>Copier…</em> (reprend l’appartenance aux groupes). <strong>PowerShell</strong> : lire les groupes du modèle et les réappliquer :</p>' }),
  cmd(`$modele = Get-ADUser "administrateur" -Properties MemberOf
Get-ADUser $modele.MemberOf | Out-Null   # (référence des groupes)
Get-ADPrincipalGroupMembership "administrateur" |
  Where-Object Name -ne "Utilisateurs du domaine" |
  ForEach-Object { Add-ADGroupMember $_ -Members "jean.nguyen" }`),

  block('heading', { level: 2, text: '5) Création en masse (import CSV)' }),
  block('html', { html: '<p>Pour créer des dizaines de comptes — ce que fait le <a href="/pages/constructeur-ad">constructeur AD de masse</a>. Prépare un fichier <code>utilisateurs.csv</code> :</p>' }),
  cmd(`Prenom;Nom;Login;OU
Jean;NGUYEN;jean.nguyen;Bureaux
Marie;DURAND;marie.durand;Bureaux`),
  block('html', { html: '<p>Puis crée les comptes en boucle (login = <code>prenom.nom</code>, UPN construit, mot de passe commun à changer) :</p>' }),
  cmd(`$mdp = Read-Host -AsSecureString "Mot de passe initial commun"
Import-Csv .\\utilisateurs.csv -Delimiter ';' | ForEach-Object {
  New-ADUser -Name "$($_.Prenom) $($_.Nom)" -GivenName $_.Prenom -Surname $_.Nom \`
    -SamAccountName $_.Login -UserPrincipalName "$($_.Login)@miyukini.lan" \`
    -Path "OU=$($_.OU),DC=miyukini,DC=lan" \`
    -AccountPassword $mdp -ChangePasswordAtLogon $true -Enabled $true
}`),
  note('gray', '💡 Idempotence', '<p>Pour rejouer sans erreur, teste l’existence avant : <code>if (-not (Get-ADUser -Filter "SamAccountName -eq \'$($_.Login)\'")) { New-ADUser ... }</code>.</p>'),

  block('heading', { level: 2, text: '6) Ajouter des membres à un groupe' }),
  cmd(`Add-ADGroupMember -Identity "G_Bureaux" -Members "jean.nguyen","marie.durand"`),

  block('heading', { level: 2, text: '7) Vérifier' }),
  cmd(`Get-ADUser -Filter * -SearchBase "OU=Bureaux,DC=miyukini,DC=lan" | Select Name,SamAccountName,Enabled
Get-ADGroupMember "G_Bureaux" | Select Name`),
  block('html', { html: '<p>En GUI, active <em>Affichage → Fonctionnalités avancées</em> pour voir tous les attributs et onglets (profil, membre de, etc.).</p>' }),

  note('green', '✅ Justification', '<p>UO, groupes, comptes à l’unité, copie de modèle et création en masse par CSV : tu as reproduit à la main ce que génèrent les constructeurs AD. Suite logique : les droits avec <a href="/pages/procedure-agdlp">AGDLP</a>. Rappel de vocabulaire : <a href="/pages/vocabulaire-active-directory">Vocabulaire Active Directory</a>.</p>'),
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

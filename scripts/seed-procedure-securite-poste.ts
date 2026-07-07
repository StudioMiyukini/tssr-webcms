/* Procédure « Sécuriser un poste / serveur Windows ». Usage : BASE=... ADMIN_PW=... tsx scripts/seed-procedure-securite-poste.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = { slug: 'procedure-securite-poste', title: 'Sécuriser un poste / serveur Windows', excerpt: 'Durcir un poste : stratégie de mots de passe (GPO), chiffrement du disque avec BitLocker, antivirus Windows Defender, pare-feu et mises à jour. Les bonnes pratiques de base de la sécurité endpoint.' };
const block = (t: Parameters<typeof makePageBlock>[0], p: Partial<PageBlock>) => Object.assign(makePageBlock(t), p);
const note = (c: string, t: string, h: string) => block('html', { html: `<aside class="pb-note pb-note-${c}"><p class="pb-note-title">${t}</p>${h}</aside>` });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stepsStyle = block('html', { html: `<style>.proc-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.55}.proc-steps{padding-left:22px;line-height:1.75}.proc-steps>li{margin:8px 0}</style>` });
const cmd = (t: string) => block('html', { html: `<div class="proc-cmd">${esc(t)}</div>` });
const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Procédure · Sécurité', title: PAGE.title, subtitle: 'Les réflexes de durcissement d’un poste et d’un serveur Windows.' }),
  stepsStyle,
  note('blue', '🎯 Défense en profondeur', '<p>La sécurité d’un poste repose sur <strong>plusieurs couches</strong> : mots de passe robustes, chiffrement du disque, antivirus, pare-feu et mises à jour. Aucune n’est suffisante seule ; c’est leur <strong>cumul</strong> qui protège.</p>'),
  block('heading', { level: 2, text: '1) Stratégie de mots de passe (GPO)' }),
  block('html', { html: '<p>Au niveau du domaine, via une <a href="/pages/procedure-gpo">GPO</a> : Configuration ordinateur → Paramètres de sécurité → <em>Stratégies de comptes → Stratégie de mot de passe</em>. Réglages recommandés :</p>' }),
  block('html', { html: `<ul>
    <li><strong>Longueur minimale</strong> : 12 caractères ou plus.</li>
    <li><strong>Complexité</strong> activée (majuscule + minuscule + chiffre + spécial).</li>
    <li><strong>Historique</strong> (ne pas réutiliser les anciens) et <strong>durée de vie</strong> maximale.</li>
    <li><strong>Verrouillage de compte</strong> après N tentatives (anti-force brute).</li>
  </ul>` }),
  block('heading', { level: 2, text: '2) Chiffrer le disque — BitLocker' }),
  block('html', { html: '<p><strong>BitLocker</strong> chiffre le disque : si la machine est volée, les données sont illisibles sans la clé. Il s’appuie sur la puce <strong>TPM</strong>.</p>' }),
  cmd(`# activer sur C: (en admin)
manage-bde -on C: -RecoveryPassword
# état / clé de récupération
manage-bde -status C:`),
  note('yellow', '🔑 Clé de récupération', '<p><strong>Conserve la clé de récupération</strong> (impression, compte AD/Azure, fichier hors machine). Sans elle, un incident TPM = données <strong>perdues</strong>. En domaine, on stocke la clé dans <strong>AD</strong> via GPO.</p>'),
  block('heading', { level: 2, text: '3) Antivirus — Windows Defender' }),
  cmd(`# état de la protection
Get-MpComputerStatus
# lancer une analyse rapide / complète
Start-MpScan -ScanType QuickScan
Start-MpScan -ScanType FullScan`),
  block('html', { html: '<p>Vérifie que la <strong>protection en temps réel</strong> est active et les <strong>signatures à jour</strong>. En entreprise, on centralise via une console (Defender for Endpoint, ou un antivirus tiers).</p>' }),
  block('heading', { level: 2, text: '4) Pare-feu & mises à jour' }),
  block('html', { html: '<ul><li><strong>Pare-feu Windows</strong> activé sur les 3 profils (Domaine/Privé/Public) ; n’ouvrir que les ports nécessaires (voir <a href="/pages/astuce-pare-feu-ping">autoriser le ping</a>).</li><li><strong>Windows Update</strong> : appliquer les correctifs (les failles non corrigées sont la 1ʳᵉ porte d’entrée). En domaine, maîtriser via <strong>WSUS</strong> ou GPO.</li></ul>' }),
  block('heading', { level: 2, text: '5) Hygiène complémentaire' }),
  block('html', { html: '<ul><li><strong>Moindre privilège</strong> : les utilisateurs ne sont <strong>pas administrateurs</strong> de leur poste.</li><li>Désactiver les <strong>comptes/services inutiles</strong>, renommer/désactiver l’Administrateur local par défaut.</li><li>Sauvegardes à jour (<a href="/pages/procedure-sauvegarde">3-2-1</a>) — la meilleure défense contre le ransomware.</li></ul>' }),
  note('green', '🔗 Liens', '<p><a href="/pages/procedure-gpo">GPO</a> · <a href="/pages/le-pare-feu">Le pare-feu</a> · <a href="/pages/procedure-sauvegarde">Sauvegarde 3-2-1</a> · <a href="/pages/permissions-partage-ntfs">Permissions NTFS</a>.</p>'),
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

/* Cours « VTP : propager les VLAN entre switches » (Réseau / Cisco Packet Tracer).
   Comment éviter de recréer les mêmes VLAN sur vingt switches — et pourquoi le
   numéro de révision VTP est le piège le plus coûteux du protocole.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cours-vlan-vtp.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = {
  slug: 'vlan-vtp',
  title: 'VTP : propager les VLAN entre switches',
  excerpt: 'Créer un VLAN une fois et le voir apparaître partout : le principe de VTP, ses modes (server, client, transparent, off), et surtout le piège du numéro de révision, capable d’effacer les VLAN de tout un réseau. Procédure d’insertion sûre d’un switch, pruning, et pourquoi beaucoup d’administrateurs choisissent aujourd’hui de s’en passer.',
};

const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const styleBlock = block('html', { html: `<style>.vl-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.55}.vl-t{border-collapse:collapse;width:100%;font-size:13px;margin:6px 0}.vl-t th,.vl-t td{border:1px solid var(--border);padding:7px 10px;text-align:left;vertical-align:top}.vl-t th{background:var(--surface-2)}.vl-flow{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:12px;margin:8px 0;white-space:pre;overflow-x:auto;font-size:12px;line-height:1.5}.vl-step{counter-reset:none;border-left:3px solid var(--accent,#059669);padding:2px 0 2px 14px;margin:10px 0}</style>` });
const cmd = (t: string) => block('html', { html: `<div class="vl-cmd">${esc(t)}</div>` });
const flow = (t: string) => block('html', { html: `<div class="vl-flow">${esc(t)}</div>` });

const blocks: PageBlock[] = [
  block('hero', {
    eyebrow: 'Cours · Réseau / Cisco',
    title: PAGE.title,
    subtitle: 'Créer un VLAN une seule fois — et comprendre pourquoi ça peut mal tourner.',
  }),
  styleBlock,

  block('html', { html: '<p>Sur un réseau à deux switches, créer les VLAN à la main ne pose aucun problème. Sur <strong>vingt switches</strong>, c’est vingt occasions de se tromper, et chaque nouveau VLAN devient une corvée. <strong>VTP</strong> (<em>VLAN Trunking Protocol</em>, propriétaire Cisco) répond à ce besoin : on crée le VLAN sur <strong>un</strong> switch, il apparaît sur <strong>tous</strong> les autres.</p>' }),

  note('blue', '🎯 Ce que VTP synchronise — et ce qu’il ne synchronise pas', '<ul><li><strong>Synchronisé</strong> : la <em>base de données VLAN</em>, c’est-à-dire la liste des VLAN (numéro + nom).</li><li><strong>Pas synchronisé</strong> : <strong>l’affectation des ports</strong>. Le <code>switchport access vlan 20</code> reste à faire sur chaque switch, port par port.</li></ul><p>C’est la confusion la plus fréquente : VTP ne configure pas le réseau à ta place, il propage seulement la <em>liste</em> des VLAN.</p>'),

  block('heading', { level: 2, text: '1) Le domaine VTP' }),
  block('html', { html: '<p>Les switches n’échangent leurs informations que s’ils appartiennent au <strong>même domaine VTP</strong> — une simple chaîne de caractères, sensible à la casse. Les annonces circulent <strong>uniquement sur les liens trunk</strong>.</p>' }),

  cmd(`enable
configure terminal
vtp domain ENTREPRISE          ! le nom doit être IDENTIQUE partout
vtp password Secret123         ! facultatif mais recommandé
vtp version 2
end`),

  note('gray', '💡 Le mot de passe VTP', '<p>Sans mot de passe, n’importe quel switch branché sur un trunk et configuré avec le bon nom de domaine peut participer. Le mot de passe est ce qui distingue « un switch de l’entreprise » de « un switch qu’on a branché ». Il doit être identique sur tous les membres.</p>'),

  block('heading', { level: 2, text: '2) Les modes' }),
  block('html', { html: `<table class="vl-t"><thead><tr><th>Mode</th><th>Peut créer / supprimer des VLAN ?</th><th>Applique ce qu’il reçoit ?</th><th>Retransmet ?</th></tr></thead><tbody>
    <tr><td><strong>server</strong><br><span class="pb-muted">(défaut)</span></td><td>Oui</td><td>Oui</td><td>Oui</td></tr>
    <tr><td><strong>client</strong></td><td><strong>Non</strong></td><td>Oui</td><td>Oui</td></tr>
    <tr><td><strong>transparent</strong></td><td>Oui, <strong>en local seulement</strong></td><td>Non</td><td>Oui <span class="pb-muted">(fait suivre sans se l’appliquer)</span></td></tr>
    <tr><td><strong>off</strong><br><span class="pb-muted">(VTPv3)</span></td><td>Oui, en local</td><td>Non</td><td><strong>Non</strong></td></tr>
  </tbody></table>` }),

  cmd(`vtp mode server         ! le switch de référence (souvent le switch coeur)
vtp mode client          ! les switches d'accès
vtp mode transparent     ! indépendant : garde sa propre liste de VLAN`),

  note('yellow', '⚠️ « client » ne veut pas dire « en lecture seule et sans danger »', '<p>Un switch en mode <strong>client</strong> ne peut pas créer de VLAN, mais il <strong>participe pleinement</strong> aux annonces : il peut <strong>en émettre</strong> et donc écraser la base des autres. Le mode client protège le switch contre l’administrateur, pas le réseau contre le switch. La suite explique pourquoi.</p>'),

  block('heading', { level: 2, text: '3) Le piège — le numéro de révision' }),
  block('html', { html: '<p>Chaque modification de la base VLAN incrémente un <strong>numéro de révision</strong>. Quand deux switches du même domaine se rencontrent, la règle est brutale et sans nuance :</p>' }),

  note('red', '🚨 La règle qui coûte cher', '<p><strong>Le numéro de révision le plus élevé gagne — et écrase l’autre.</strong> Peu importe le mode, peu importe l’ancienneté du switch, peu importe qui a raison. Le plus grand nombre l’emporte.</p>'),

  block('html', { html: '<p>Le scénario classique, celui qui coupe un réseau de production un lundi matin :</p>' }),

  flow(`1. Un switch traîne au labo. On y a fait 50 essais de VLAN.
      → domaine ENTREPRISE, révision 87, base VLAN : 1, 5, 7

2. Un poste est en panne. On rebranche ce switch en salle serveur
   pour dépanner, sans y penser.
      → le réseau de production est en révision 12,
        base VLAN : 1, 10, 20, 30, 40, 99

3. Le switch du labo annonce sa révision 87.
      87 > 12  →  TOUS les switches adoptent sa base

4. Les VLAN 10, 20, 30, 40 et 99 DISPARAISSENT du réseau entier.
   Tous les ports qui y étaient affectés basculent en "inactive".
      → le réseau tombe.`),

  block('heading', { level: 2, text: '4) La procédure sûre d’insertion' }),
  block('html', { html: '<p>Un switch qu’on rebranche doit <strong>toujours</strong> arriver avec une révision à zéro. Deux méthodes pour la remettre à zéro :</p>' }),

  cmd(`! Méthode 1 — passer en transparent puis revenir
vtp mode transparent
vtp mode client
! le passage par transparent remet le compteur à 0

! Méthode 2 — changer de domaine puis revenir
vtp domain TEMPORAIRE
vtp domain ENTREPRISE
! changer de domaine remet aussi le compteur à 0`),

  cmd(`! TOUJOURS vérifier AVANT de brancher le lien trunk
show vtp status

! Les deux lignes à lire :
!   Configuration Revision : 0        ← doit être à 0
!   VTP Operating Mode     : Client   ← le mode voulu`),

  note('green', '✅ Le réflexe à prendre', '<p>Avant de brancher un switch qui vient d’ailleurs — labo, stock, autre site, prêt d’un collègue — <strong>vérifie sa révision avant de connecter le trunk</strong>. Un <code>show vtp status</code> de dix secondes évite une panne d’une heure. C’est la seule règle de ce cours qui mérite d’être retenue par cœur.</p>'),

  block('heading', { level: 2, text: '5) Le pruning — ne pas transporter pour rien' }),
  block('html', { html: '<p>Par défaut, un trunk transporte le trafic de diffusion (<em>broadcast</em>) de <strong>tous</strong> les VLAN autorisés — y compris vers des switches qui n’ont <strong>aucun port</strong> dans ces VLAN. Le <strong>pruning</strong> supprime automatiquement ce trafic inutile.</p>' }),

  cmd(`vtp pruning        ! à activer sur le serveur VTP ; se propage au domaine`),

  flow(`SANS pruning                      AVEC pruning

  Coeur                             Coeur
   │ broadcast VLAN 10               │ broadcast VLAN 10
   ├──► SW-A (a des ports VLAN 10)   ├──► SW-A  (a des ports VLAN 10)
   └──► SW-B (aucun port VLAN 10)    └──╳  SW-B  élagué, rien n'est envoyé
        ↑ bande passante gaspillée`),

  note('gray', '💡 Pruning vs allowed vlan', '<p>Les deux limitent ce qui circule, mais pas de la même façon. <code>switchport trunk allowed vlan</code> est une décision <strong>manuelle et permanente</strong>, que tu écris. Le pruning est <strong>automatique et dynamique</strong> : il suit l’état réel des ports. Ils se complètent — le premier pour la sécurité, le second pour la bande passante.</p>'),

  block('heading', { level: 2, text: '6) Faut-il encore utiliser VTP ?' }),
  block('html', { html: '<p>Question légitime, et la réponse honnête est : <strong>de moins en moins</strong>. Beaucoup d’administrateurs configurent aujourd’hui tous leurs switches en <strong>transparent</strong> (ou <strong>off</strong> en VTPv3) et créent les VLAN à la main.</p>' }),

  block('html', { html: `<table class="vl-t"><thead><tr><th>Argument pour VTP</th><th>Argument contre</th></tr></thead><tbody>
    <tr><td>Un seul endroit où créer un VLAN.</td><td>Le risque d’écrasement par révision reste, même bien géré.</td></tr>
    <tr><td>Cohérence garantie des noms de VLAN.</td><td>Les VLAN se créent rarement — le gain est faible, le risque permanent.</td></tr>
    <tr><td>Le pruning économise de la bande passante.</td><td><code>allowed vlan</code> fait l’essentiel du travail, sans dépendance.</td></tr>
    <tr><td>—</td><td>Les configurations sont aujourd’hui déployées par des outils (Ansible, scripts) : la propagation automatique n’a plus d’intérêt.</td></tr>
  </tbody></table>` }),

  note('blue', '🎓 Ce qu’on attend de toi en examen et en entreprise', '<p><strong>Comprendre VTP reste indispensable</strong> : tu le rencontreras sur des réseaux existants, et la panne par révision fait partie des classiques du dépannage. Mais sur une infrastructure que tu conçois, le mode <strong>transparent</strong> partout est un choix défendable — et de plus en plus répandu.</p>'),

  block('heading', { level: 2, text: '7) Vérifier' }),
  cmd(`show vtp status          ! domaine, mode, version, révision, nb de VLAN
show vtp counters        ! annonces émises / reçues (utile en dépannage)
show vlan brief          ! la base VLAN réellement appliquée
show interfaces trunk    ! sur quels liens VTP peut circuler`),

  note('yellow', '🛠️ Dépannage courant', '<ul><li><strong>Un switch ne reçoit rien</strong> → nom de domaine différent (attention à la casse), ou mot de passe différent, ou aucun lien <strong>trunk</strong> vers lui : VTP ne circule pas sur un port access.</li><li><strong>Des VLAN ont disparu</strong> → un switch a imposé une révision plus élevée. Voir la section 3.</li><li><strong>« VTP is not configured »</strong> → le domaine est vide. Un switch sans domaine adopte le premier qu’il entend : c’est une autre bonne raison de nommer le domaine explicitement partout.</li><li><strong>Le mode transparent ne bloque pas la panne</strong> → il protège <em>ce</em> switch, mais laisse passer les annonces vers les suivants.</li></ul>'),

  note('green', '🔗 Pour aller plus loin', '<p>Cours liés : <a href="/pages/les-vlan">Les VLAN &amp; le routage inter-VLAN</a>, <a href="/pages/vlan-securite">Sécuriser les VLAN</a>, <a href="/pages/le-switch">Le switch</a>. Procédure : <a href="/pages/procedure-atelier-reseau-az">Construire un réseau multi-routeurs de A à Z</a>. Outil : <a href="/pages/atelier-reseau">Atelier Réseau</a>.</p>'),
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

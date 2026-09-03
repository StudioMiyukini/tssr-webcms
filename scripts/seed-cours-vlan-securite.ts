/* Cours « Sécuriser les VLAN » (Réseau / Cisco Packet Tracer).
   Suite du cours « Les VLAN & le routage inter-VLAN » : un VLAN mal configuré
   n'isole rien. On traite les deux attaques classiques (switch spoofing et
   double tagging), puis le durcissement des ports.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cours-vlan-securite.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = {
  slug: 'vlan-securite',
  title: 'Sécuriser les VLAN',
  excerpt: 'Un VLAN n’est pas une frontière étanche par défaut. Les deux attaques de saut de VLAN (switch spoofing via DTP, double marquage 802.1Q), puis le durcissement : mode access explicite, VLAN natif dédié, port-security, ports inutilisés. Config CLI Cisco et vérifications.',
};

const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const styleBlock = block('html', { html: `<style>.vl-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.55}.vl-t{border-collapse:collapse;width:100%;font-size:13px;margin:6px 0}.vl-t th,.vl-t td{border:1px solid var(--border);padding:7px 10px;text-align:left;vertical-align:top}.vl-t th{background:var(--surface-2)}.vl-flow{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:12px;margin:8px 0;white-space:pre;overflow-x:auto;font-size:12px;line-height:1.5}</style>` });
const cmd = (t: string) => block('html', { html: `<div class="vl-cmd">${esc(t)}</div>` });
const flow = (t: string) => block('html', { html: `<div class="vl-flow">${esc(t)}</div>` });

const blocks: PageBlock[] = [
  block('hero', {
    eyebrow: 'Cours · Réseau / Sécurité',
    title: PAGE.title,
    subtitle: 'Séparer en VLAN ne suffit pas : encore faut-il que la séparation tienne.',
  }),
  styleBlock,

  block('html', { html: '<p>Le cours <a href="/pages/les-vlan">Les VLAN &amp; le routage inter-VLAN</a> a montré comment <strong>découper</strong> un switch. Reste une question que l’on oublie souvent : cette séparation <strong>résiste-t-elle à quelqu’un qui cherche à la contourner</strong> ?</p><p>Réponse : <strong>pas avec la configuration par défaut</strong>. Un switch Cisco sorti du carton accepte de négocier des liens trunk tout seul, et le VLAN natif circule sans étiquette. Ce sont exactement les deux portes utilisées par les attaques de <strong>saut de VLAN</strong> (<em>VLAN hopping</em>).</p>' }),

  note('red', '⚠️ L’idée fausse à corriger', '<p>« Mes serveurs sont sur le VLAN 30, ils sont donc isolés du VLAN 20 des utilisateurs. » C’est vrai <strong>tant que personne ne triche</strong>. Un VLAN est une séparation <strong>logique</strong>, appliquée par le switch : si on obtient du switch qu’il se comporte autrement, la séparation tombe.</p>'),

  block('heading', { level: 2, text: '1) Attaque 1 — Le switch spoofing (via DTP)' }),
  block('html', { html: '<p>Par défaut, un port Cisco est en <strong>négociation automatique</strong> : il utilise <strong>DTP</strong> (<em>Dynamic Trunking Protocol</em>) pour se mettre d’accord avec l’équipement d’en face sur le fait de devenir un port <em>access</em> ou un port <em>trunk</em>.</p><p>Le problème est immédiat : un poste attaquant peut <strong>parler DTP</strong> et se faire passer pour un switch. Le port bascule alors en trunk — et un trunk transporte <strong>tous les VLAN</strong>.</p>' }),

  flow(`AVANT (port par défaut, en négociation)

   [ PC attaquant ] --- Fa0/5 ---> le port devient TRUNK
        parle DTP                  → voit VLAN 10, 20, 30, 99…

APRÈS (port forcé en access)

   [ PC attaquant ] --- Fa0/5 ---> reste ACCESS, VLAN 20 seulement
        parle DTP                  → DTP ignoré, aucune négociation`),

  block('html', { html: '<p>La parade tient en deux lignes : <strong>forcer</strong> le mode du port et <strong>couper</strong> la négociation.</p>' }),
  cmd(`interface range FastEthernet0/1 - 20
 switchport mode access          ! forcé en access, pas de négociation possible
 switchport access vlan 20
 switchport nonegotiate          ! n'émet plus de trames DTP
 exit`),

  note('gray', '💡 Et sur les vrais trunks ?', '<p>Un lien entre deux switches doit être trunk — mais là aussi, on le <strong>déclare</strong> au lieu de le négocier : <code>switchport mode trunk</code> puis <code>switchport nonegotiate</code>. La négociation automatique est une commodité de laboratoire, pas une pratique de production.</p>'),

  block('heading', { level: 2, text: '2) Attaque 2 — Le double marquage (double tagging)' }),
  block('html', { html: '<p>Celle-ci est plus subtile et exploite le <strong>VLAN natif</strong>. Rappel du cours précédent : sur un trunk, le VLAN natif est <strong>le seul à circuler sans étiquette</strong>.</p><p>L’attaquant place <strong>deux étiquettes</strong> dans sa trame : la première correspond au VLAN natif, la seconde au VLAN qu’il veut atteindre.</p>' }),

  flow(`Trame forgée :  [ tag VLAN 1 (natif) ][ tag VLAN 30 ][ données ]

  Switch 1 (port access sur VLAN natif 1)
    → retire le PREMIER tag (c'est le natif, il part sans étiquette)
    → transmet sur le trunk :  [ tag VLAN 30 ][ données ]

  Switch 2 (à l'autre bout du trunk)
    → lit le tag VLAN 30 en toute confiance
    → livre la trame dans le VLAN 30   ← la séparation est tombée`),

  note('yellow', '🔒 Ce que l’attaque permet et ne permet pas', '<p>Le trafic ne part que dans <strong>un seul sens</strong> : l’attaquant peut <strong>envoyer</strong> dans le VLAN visé, mais la réponse ne lui revient pas. C’est suffisant pour du déni de service ou l’envoi de commandes, pas pour une conversation. Cela n’en fait pas un détail : une trame injectée dans le VLAN des serveurs reste une trame injectée dans le VLAN des serveurs.</p>'),

  block('html', { html: '<p>La parade repose sur une règle simple : <strong>le VLAN natif ne doit contenir aucun poste</strong>.</p>' }),
  cmd(`! 1. Créer un VLAN natif dédié, qui ne sert QU'à ça
vlan 999
 name NATIF-INUTILISE
 exit

! 2. L'imposer sur tous les trunks, des DEUX côtés du lien
interface GigabitEthernet0/1
 switchport mode trunk
 switchport trunk native vlan 999
 switchport trunk allowed vlan 10,20,30      ! le natif n'a pas à être autorisé
 switchport nonegotiate
 exit`),

  note('blue', '🎯 Pourquoi ça suffit', '<ul><li>Le VLAN natif 999 ne contient <strong>aucun port access</strong> : personne ne peut émettre une trame qui en sortirait sans étiquette.</li><li>Le VLAN 1 par défaut n’est plus le natif : les valeurs devinées par un attaquant ne mènent nulle part.</li><li><code>allowed vlan</code> limite ce qui transite : un VLAN absent de la liste ne franchit pas le trunk, quoi qu’il arrive.</li></ul>'),

  block('heading', { level: 2, text: '3) Port-security — limiter qui se branche' }),
  block('html', { html: '<p>Les deux attaques précédentes supposent un accès physique à une prise. Le <strong>port-security</strong> répond à ce problème-là : il limite <strong>combien</strong> et <strong>quelles</strong> adresses MAC un port accepte.</p>' }),

  cmd(`interface FastEthernet0/5
 switchport mode access
 switchport access vlan 20
 switchport port-security                      ! active la fonction
 switchport port-security maximum 2            ! 2 MAC max (ex. PC + téléphone IP)
 switchport port-security mac-address sticky   ! apprend et mémorise les MAC vues
 switchport port-security violation restrict   ! que faire en cas d'infraction
 exit`),

  block('html', { html: `<table class="vl-t"><thead><tr><th>Mode de violation</th><th>Effet</th><th>Quand l’utiliser</th></tr></thead><tbody>
    <tr><td><code>protect</code></td><td>Jette les trames en trop, <strong>silencieusement</strong>.</td><td>Rarement : une attaque passe inaperçue.</td></tr>
    <tr><td><code>restrict</code></td><td>Jette les trames <strong>et journalise</strong> (compteur + SNMP/syslog).</td><td>Le bon défaut en production : on sait, sans couper.</td></tr>
    <tr><td><code>shutdown</code></td><td>Passe le port en <code>err-disabled</code> : plus rien ne passe.</td><td>Zones sensibles. Attention : il faut une intervention pour rouvrir.</td></tr>
  </tbody></table>` }),

  note('yellow', '🛠️ Le piège du mode shutdown', '<p>C’est le mode <strong>par défaut</strong>. Un port en <code>err-disabled</code> ne se rouvre pas tout seul : il faut un <code>shutdown</code> puis <code>no shutdown</code> sur l’interface. En salle de formation comme en entreprise, c’est la première cause de « le port est mort » après un branchement malheureux. Pour automatiser la reprise :</p>' + `<div class="vl-cmd">errdisable recovery cause psecure-violation
errdisable recovery interval 300     ! réactivation automatique après 5 min</div>`),

  block('heading', { level: 2, text: '4) Les ports inutilisés' }),
  block('html', { html: '<p>Une prise murale libre dans un couloir est une porte ouverte. Deux gestes, systématiques :</p>' }),
  cmd(`! Un VLAN "poubelle", isolé et sans passerelle
vlan 666
 name PARKING
 exit

interface range FastEthernet0/21 - 24
 switchport mode access
 switchport access vlan 666      ! s'il est branché, il n'atteint rien
 shutdown                        ! et de toute façon, le port est éteint
 exit`),

  note('gray', '💡 Pourquoi les deux', '<p>Le <code>shutdown</code> suffirait — mais un collègue pressé fera un <code>no shutdown</code> pour dépanner quelqu’un et oubliera le reste. Le VLAN parking est le <strong>filet de sécurité</strong> : même rouvert par erreur, le port ne donne accès à rien.</p>'),

  block('heading', { level: 2, text: '5) Récapitulatif — la checklist' }),
  block('html', { html: `<table class="vl-t"><thead><tr><th>#</th><th>Mesure</th><th>Ce qu’elle bloque</th></tr></thead><tbody>
    <tr><td>1</td><td><code>switchport mode access</code> + <code>nonegotiate</code> sur tous les ports utilisateurs</td><td>Switch spoofing</td></tr>
    <tr><td>2</td><td><code>switchport mode trunk</code> + <code>nonegotiate</code> sur les liens inter-switches</td><td>Switch spoofing</td></tr>
    <tr><td>3</td><td>VLAN natif dédié, sans aucun port access, identique des deux côtés</td><td>Double tagging</td></tr>
    <tr><td>4</td><td><code>switchport trunk allowed vlan</code> restreint au strict nécessaire</td><td>Propagation latérale</td></tr>
    <tr><td>5</td><td><code>port-security</code> avec <code>maximum</code> et <code>violation restrict</code></td><td>Branchement sauvage, saturation de la table MAC</td></tr>
    <tr><td>6</td><td>Ports inutilisés : VLAN parking + <code>shutdown</code></td><td>Accès physique opportuniste</td></tr>
    <tr><td>7</td><td>Ne jamais laisser de données utilisateur sur le VLAN 1</td><td>Cible par défaut de tout scan</td></tr>
  </tbody></table>` }),

  block('heading', { level: 2, text: '6) Vérifier' }),
  cmd(`show interfaces switchport            ! mode réel du port, VLAN natif, négociation
show interfaces trunk                 ! trunks actifs, VLAN autorisés, VLAN natif
show port-security                    ! résumé : ports protégés et violations
show port-security interface Fa0/5    ! détail d'un port
show interfaces status err-disabled   ! ports coupés par une violation`),

  note('blue', '🔎 Ce qu’on lit dans « show interfaces switchport »', '<p>Deux lignes valent le déplacement : <code>Administrative Mode</code> (ce que tu as configuré) et <code>Operational Mode</code> (ce que le port <strong>fait réellement</strong>). Si tu lis <code>dynamic auto</code> ou <code>dynamic desirable</code> en mode administratif, la négociation est active : le port est vulnérable au switch spoofing.</p>'),

  note('green', '🔗 Pour aller plus loin', '<p>Cours liés : <a href="/pages/les-vlan">Les VLAN &amp; le routage inter-VLAN</a>, <a href="/pages/le-switch">Le switch</a>, <a href="/pages/radius-8021x">RADIUS &amp; 802.1X</a> (l’étape suivante : authentifier la machine avant même de lui donner un VLAN), <a href="/pages/le-pare-feu">Le pare-feu</a>. Outil : <a href="/atelier">Atelier Réseau</a>.</p>'),
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

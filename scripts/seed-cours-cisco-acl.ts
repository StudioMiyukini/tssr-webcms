/* Cours « Les ACL : listes de contrôle d'accès » (Cisco Packet Tracer).
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cours-cisco-acl.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = { slug: 'cisco-acl', title: 'Les ACL : filtrer le trafic (listes de contrôle d’accès)', excerpt: 'Autoriser ou bloquer du trafic sur un routeur Cisco : ACL et ACE, les trois restrictions (une par interface, par sens, par protocole), standard vs étendue, masque générique, structure d’une ACE, table des ports à connaître, deny implicite, placement et vérifications.' };
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const styleBlock = block('html', { html: `<style>.ax-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.55}.ax-t{border-collapse:collapse;width:100%;font-size:13px;margin:6px 0}.ax-t th,.ax-t td{border:1px solid var(--border);padding:7px 10px;text-align:left}.ax-t th{background:var(--surface-2)}.ax-t td:first-child{font-family:ui-monospace,monospace;white-space:nowrap}</style>` });
const cmd = (t: string) => block('html', { html: `<div class="ax-cmd">${esc(t)}</div>` });

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Cisco / Packet Tracer', title: PAGE.title, subtitle: 'Le pare-feu du routeur : décider, ligne par ligne, ce qui passe et ce qui est bloqué.' }),
  styleBlock,
  block('html', { html: '<p>Une <strong>ACL</strong> (<em>Access Control List</em>) est une <strong>liste de règles</strong> qui <strong>autorisent</strong> (<code>permit</code>) ou <strong>interdisent</strong> (<code>deny</code>) du trafic sur un routeur. On l’applique à une <strong>interface</strong>, dans un <strong>sens</strong> (entrant ou sortant). Le routeur lit les règles <strong>de haut en bas</strong> et s’arrête à la <strong>première qui correspond</strong>.</p>' }),
  note('yellow', '⚠️ Le « deny any » implicite', '<p>À la fin de toute ACL se cache une règle invisible : <strong><code>deny any</code></strong>. Tout ce qui n’est pas <strong>explicitement autorisé</strong> est donc <strong>rejeté</strong>. Il faut au moins un <code>permit</code>, sinon l’ACL bloque tout.</p>'),

  block('heading', { level: 2, text: '1) Rappel : ce que la passerelle regarde' }),
  block('html', { html: '<p>Une ACL travaille sur deux couches du modèle OSI, et seulement deux. C’est ce qui délimite exactement ce qu’elle sait faire — et ce qu’elle ne saura jamais faire.</p>' }),
  block('html', { html: `<table class="ax-t"><thead><tr><th>Couche</th><th>Ce que la passerelle y lit</th><th>Ce qu’on peut filtrer</th></tr></thead><tbody>
    <tr><td><strong>3 — Réseau</strong></td><td>l’en-tête <strong>IP</strong> : adresse source, adresse destination, protocole encapsulé</td><td>« qui parle à qui »</td></tr>
    <tr><td><strong>4 — Transport</strong></td><td>l’en-tête <strong>TCP</strong> ou <strong>UDP</strong> : port source, port destination</td><td>« pour faire quoi » — le service visé</td></tr>
  </tbody></table>` }),
  note('gray', '📎 Ce qu’une ACL ne voit pas', '<p>Elle ne lit <strong>ni le contenu</strong> du paquet, ni l’utilisateur, ni l’application réelle derrière le port. Un serveur web qui écoute sur 8080 passe une règle écrite pour le port 80 : l’ACL filtre des <strong>numéros</strong>, pas des intentions. C’est un pare-feu <em>sans état</em> — pour le reste, il faut un vrai pare-feu.</p>'),

  block('heading', { level: 2, text: '2) ACL, ACE : le vocabulaire' }),
  block('html', { html: `<table class="ax-t"><thead><tr><th>Terme</th><th>Ce que c’est</th></tr></thead><tbody>
    <tr><td><strong>ACL</strong><br><em>Access Control List</em></td><td>la <strong>liste</strong> de règles, portée par la passerelle</td></tr>
    <tr><td><strong>ACE</strong><br><em>Access Control Entry</em></td><td><strong>une</strong> règle de la liste, avec son propre numéro d’ordre</td></tr>
    <tr><td><code>permit</code> / <code>deny</code></td><td>l’<strong>autorisation</strong> portée par l’ACE</td></tr>
    <tr><td><strong>wildcard</strong></td><td>le <strong>masque générique</strong> qui dit quels bits doivent correspondre</td></tr>
  </tbody></table>` }),
  block('html', { html: '<p>La liste est lue <strong>dans l’ordre</strong>, de haut en bas, et la lecture <strong>s’arrête à la première ACE qui correspond</strong>. Une règle large placée trop haut rend donc muettes toutes celles du dessous — c’est la panne la plus fréquente, et la plus silencieuse : la configuration est acceptée, elle ne fait simplement pas ce qu’on croit.</p>' }),

  block('heading', { level: 2, text: '3) Les trois restrictions' }),
  block('html', { html: '<p>Un routeur porte <strong>autant d’ACL que l’on veut</strong>, et chaque ACL contient <strong>autant d’ACE que l’on veut</strong>. Mais l’<strong>application</strong> obéit à trois limites, et elles se retiennent ensemble :</p>' }),
  block('html', { html: `<ul>
    <li>une ACL <strong>par interface</strong> ;</li>
    <li>une ACL <strong>par sens</strong> — entrante (<code>in</code>) ou sortante (<code>out</code>) ;</li>
    <li>une ACL <strong>par protocole</strong> — IPv4 ou IPv6.</li>
  </ul>` }),
  note('yellow', '⚠️ Poser la deuxième ne prévient pas', '<p>Appliquer une seconde ACL sur la même interface, dans le même sens, <strong>remplace</strong> silencieusement la première. Aucun message. C’est <code>show ip interface</code> qui dira laquelle est réellement en place.</p>'),

  block('heading', { level: 2, text: '4) Standard ou étendue' }),
  block('html', { html: `<table class="ax-t"><thead><tr><th>Type</th><th>Numéros</th><th>Filtre sur</th><th>Où la placer</th></tr></thead><tbody>
    <tr><td><strong>Standard</strong></td><td>1–99 et 1300–1999</td><td>l’<strong>IP source</strong> uniquement</td><td>au plus près de la <strong>destination</strong></td></tr>
    <tr><td><strong>Étendue</strong></td><td>100–199 et 2000–2699</td><td>source + <strong>destination</strong> + <strong>protocole</strong> + <strong>port</strong></td><td>au plus près de la <strong>source</strong></td></tr>
  </tbody></table>` }),
  block('html', { html: '<p><strong>Le placement se déduit du type, il ne se choisit pas au hasard.</strong> Une standard ne connaît que la source : posée trop tôt, elle couperait aussi les flux légitimes de cette source vers d’autres destinations. Une étendue sait exactement ce qu’elle bloque, autant le faire avant que le paquet ne traverse le réseau.</p>' }),
  block('html', { html: '<p>On peut aussi <strong>nommer</strong> une ACL au lieu de la numéroter : <strong>alphanumérique, sans espace ni ponctuation</strong>. Un nom se relit six mois plus tard, un numéro non.</p>' }),

  block('heading', { level: 2, text: '5) Le masque générique (wildcard)' }),
  block('html', { html: '<p>Les ACL n’utilisent pas le masque réseau, mais son <strong>inverse</strong>. Un bit à <strong>0</strong> = « doit correspondre », un bit à <strong>1</strong> = « peu importe ». D’où le calcul mental : <strong>wildcard = 255.255.255.255 − masque</strong>.</p>' }),
  block('html', { html: `<table class="ax-t"><thead><tr><th>Cible</th><th>Écriture</th></tr></thead><tbody>
    <tr><td>un réseau /24</td><td><code>192.168.1.0 0.0.0.255</code></td></tr>
    <tr><td>un réseau /27</td><td><code>192.168.10.0 0.0.0.31</code></td></tr>
    <tr><td>un réseau /29</td><td><code>192.168.10.72 0.0.0.7</code></td></tr>
    <tr><td>une seule machine</td><td><code>host 172.16.10.20</code> (ou <code>… 0.0.0.0</code>)</td></tr>
    <tr><td>tout le monde</td><td><code>any</code> (ou <code>0.0.0.0 255.255.255.255</code>)</td></tr>
  </tbody></table>` }),
  note('yellow', '⚠️ Le masque à l’endroit est accepté', '<p>Écrire <code>255.255.255.0</code> au lieu de <code>0.0.0.255</code> ne produit <strong>aucune erreur</strong> : le routeur prend la ligne et filtre autre chose que ce que tu voulais. Le seul contrôle est de relire, ou de regarder le compteur de correspondances.</p>'),

  block('heading', { level: 2, text: '6) La structure d’une ACE étendue' }),
  block('html', { html: '<p>Une ACE étendue se lit <strong>de gauche à droite</strong>, toujours dans le même ordre. Chaque morceau est facultatif sauf l’autorisation, le protocole et les deux cibles :</p>' }),
  block('html', { html: `<table class="ax-t"><thead><tr><th>Autorisation</th><th>Protocole</th><th>Source</th><th>Port src.</th><th>Destination</th><th>Port dest.</th></tr></thead><tbody>
    <tr><td><code>permit</code></td><td><code>tcp</code></td><td><code>192.168.1.0 0.0.0.255</code></td><td><code>gt 1023</code></td><td><code>host 172.16.10.20</code></td><td><code>eq 443</code></td></tr>
  </tbody></table>` }),
  block('html', { html: '<p>Ce qui se lit : « autoriser le TCP venant du réseau 192.168.1.0/24, depuis n’importe quel port au-dessus de 1023, vers la machine 172.16.10.20, sur le port 443 ». Le port source <code>gt 1023</code> décrit le <strong>port éphémère</strong> d’un client — c’est la forme normale d’une requête sortante.</p>' }),
  block('html', { html: `<table class="ax-t"><thead><tr><th>Mot-clé</th><th>Ce qu’il désigne</th></tr></thead><tbody>
    <tr><td><code>host</code></td><td>une adresse précise, une seule</td></tr>
    <tr><td><code>any</code></td><td>n’importe quelle adresse</td></tr>
    <tr><td><code>eq</code></td><td>égal à ce port</td></tr>
    <tr><td><code>gt</code> / <code>lt</code></td><td>plus grand que / plus petit que</td></tr>
    <tr><td><code>neq</code></td><td>différent de</td></tr>
    <tr><td><code>range</code></td><td>entre deux ports, bornes comprises</td></tr>
  </tbody></table>` }),

  block('heading', { level: 2, text: '7) Les ports à connaître' }),
  block('html', { html: '<p>Ce sont ceux de l’exercice, et ceux qu’on écrit de mémoire en TP. IOS accepte le <strong>numéro</strong> comme le <strong>mot-clé</strong> : <code>eq 80</code> et <code>eq www</code> sont la même règle.</p>' }),
  block('html', { html: `<table class="ax-t"><thead><tr><th>Port</th><th>Proto</th><th>Mot-clé IOS</th><th>Service</th></tr></thead><tbody>
    <tr><td>20</td><td>tcp</td><td><code>ftp-data</code></td><td>FTP — canal de données</td></tr>
    <tr><td>21</td><td>tcp</td><td><code>ftp</code></td><td>FTP — canal de commandes</td></tr>
    <tr><td>22</td><td>tcp</td><td><code>ssh</code></td><td>SSH — administration chiffrée</td></tr>
    <tr><td>23</td><td>tcp</td><td><code>telnet</code></td><td>Telnet — en clair, à bloquer</td></tr>
    <tr><td>25</td><td>tcp</td><td><code>smtp</code></td><td>SMTP — envoi de courriel</td></tr>
    <tr><td>53</td><td>udp</td><td><code>domain</code></td><td>DNS — résolution de noms</td></tr>
    <tr><td>67 / 68</td><td>udp</td><td><code>bootps</code> / <code>bootpc</code></td><td>DHCP — serveur / client</td></tr>
    <tr><td>80</td><td>tcp</td><td><code>www</code></td><td>HTTP</td></tr>
    <tr><td>110 / 995</td><td>tcp</td><td><code>pop3</code> / 995</td><td>POP3 — en clair / chiffré</td></tr>
    <tr><td>143 / 993</td><td>tcp</td><td>143 / 993</td><td>IMAP4 — en clair / chiffré</td></tr>
    <tr><td>161 / 162</td><td>udp</td><td><code>snmp</code> / <code>snmptrap</code></td><td>SNMP — supervision / alertes</td></tr>
    <tr><td>389</td><td>tcp</td><td>389</td><td>LDAP — annuaire</td></tr>
    <tr><td>443</td><td>tcp</td><td>443</td><td>HTTPS</td></tr>
    <tr><td>&gt; 1023</td><td>tcp/udp</td><td><code>gt 1023</code></td><td>ports éphémères — le côté client d’une connexion</td></tr>
  </tbody></table>` }),
  block('html', { html: '<p>ICMP n’a <strong>pas de port</strong> : on filtre son <strong>type de message</strong>. Un ping, ce sont les deux moitiés — <code>echo</code> à l’aller, <code>echo-reply</code> au retour. Autoriser l’un sans l’autre laisse le ping sans réponse.</p>' }),
  cmd(`access-list 120 permit icmp 192.168.1.0 0.0.0.255 any echo
access-list 120 permit icmp any 192.168.1.0 0.0.0.255 echo-reply`),

  block('heading', { level: 2, text: '8) ACL standard — exemple' }),
  block('html', { html: '<p>Autoriser le réseau Admin (<code>192.168.10.72/29</code>) à joindre les serveurs, bloquer le reste. On la place <strong>en sortie</strong>, près de la destination :</p>' }),
  cmd(`access-list 10 remark seuls les postes d'administration
access-list 10 permit 192.168.10.72 0.0.0.7
! (deny any implicite en dessous)
!
interface GigabitEthernet0/0
 ip access-group 10 out
 exit`),

  block('heading', { level: 2, text: '9) ACL étendue — exemple' }),
  block('html', { html: '<p>Autoriser uniquement le <strong>web</strong> depuis le LAN Atelier vers le serveur, refuser le reste vers ce serveur, laisser passer tout le reste. On la place <strong>près de la source</strong>, en entrée :</p>' }),
  cmd(`access-list 110 permit tcp 192.168.10.0 0.0.0.31 host 192.168.10.51 eq 80
access-list 110 permit tcp 192.168.10.0 0.0.0.31 host 192.168.10.51 eq 443
access-list 110 deny ip any host 192.168.10.51
access-list 110 permit ip any any
!
interface GigabitEthernet0/0
 ip access-group 110 in
 exit`),
  note('gray', '📝 La même, nommée', '<div class="ax-cmd">ip access-list extended WEB-SEULEMENT\n remark le serveur web du siege\n permit tcp 192.168.10.0 0.0.0.31 host 192.168.10.51 eq 80\n permit tcp 192.168.10.0 0.0.0.31 host 192.168.10.51 eq 443\n deny ip any host 192.168.10.51\n permit ip any any\n exit\ninterface Gig0/0\n ip access-group WEB-SEULEMENT in</div>'),

  block('heading', { level: 2, text: '10) L’ordre, et le deny implicite' }),
  note('yellow', '⚠️ Le « deny any » que personne n’écrit', '<p>À la fin de <strong>toute</strong> ACL se cache une règle invisible : <strong><code>deny any</code></strong>. Tout ce qui n’est pas <strong>explicitement autorisé</strong> tombe. Il faut donc au moins un <code>permit</code> — et souvent un <code>permit ip any any</code> final quand on ne voulait bloquer qu’une chose précise.</p>'),
  block('html', { html: `<ul>
    <li><strong>Le plus spécifique d’abord.</strong> Une règle large en haut masque tout ce qui suit.</li>
    <li><strong>Une règle jamais lue ne dit rien.</strong> Son compteur reste à zéro dans <code>show access-lists</code> : c’est le symptôme à chercher.</li>
    <li><strong>Commente avec <code>remark</code>.</strong> Six mois plus tard, <code>permit tcp any host 10.0.0.5 eq 389</code> ne rappelle à personne pourquoi il existe.</li>
  </ul>` }),

  block('heading', { level: 2, text: '11) Vérifier' }),
  cmd(`show access-lists            ! les règles, et le compteur de correspondances
show ip interface Gig0/0     ! quelle ACL est appliquée, dans quel sens
show running-config | section access-list`),
  note('yellow', '🛠️ Le diagnostic en trois questions', '<p>Le filtrage « ne marche pas » ? <strong>1.</strong> L’ACL est-elle <em>appliquée</em> (<code>show ip interface</code>) ? <strong>2.</strong> Sur la bonne interface, dans le bon <em>sens</em> ? <strong>3.</strong> Le compteur de la règle attendue augmente-t-il ? S’il reste à zéro, une règle au-dessus l’a déjà attrapée.</p>'),

  block('heading', { level: 2, text: '12) Exercice — une ACL par interface' }),
  block('html', { html: '<p>L’exercice du cours demande d’écrire, <strong>pour chaque interface du routeur et pour chaque sens</strong>, la liste des ACE qui appliquent la politique voulue. La grille est toujours la même :</p>' }),
  block('html', { html: `<table class="ax-t"><thead><tr><th>Interface</th><th>ACL</th><th>Sens</th><th>ACE</th><th>Autorisation</th><th>Protocole</th><th>Source + port</th><th>Destination + port</th></tr></thead><tbody>
    <tr><td><code>fa0/0</code></td><td>100</td><td>in</td><td>10</td><td><code>permit</code></td><td><code>tcp</code></td><td><code>192.168.1.0 0.0.0.255 gt 1023</code></td><td><code>host 172.16.10.20 eq 443</code></td></tr>
    <tr><td colspan="8"><em>…une ligne par règle, dans l’ordre de lecture.</em></td></tr>
  </tbody></table>` }),
  note('green', '🧪 Le faire dans l’atelier', '<p>L’<a href="/pages/atelier-reseau">Atelier Réseau</a> a une étape <strong>🚦 ACL (filtrage)</strong> : on y compose les ACE ligne à ligne, les sources et destinations se piochent dans le plan d’adressage du TP (le <strong>wildcard est calculé</strong>), et l’outil signale les règles jamais lues, l’ACL qui bloque tout et les numéros hors plage. La configuration à coller sort prête.</p>'),

  block('heading', { level: 2, text: '13) Vocabulaire' }),
  block('html', { html: `<table class="ax-t"><thead><tr><th>Sigle</th><th>Développé</th><th>En une phrase</th></tr></thead><tbody>
    <tr><td><strong>ACL</strong></td><td>Access Control List</td><td>la liste de règles portée par la passerelle</td></tr>
    <tr><td><strong>ACE</strong></td><td>Access Control Entry</td><td>une règle de cette liste</td></tr>
    <tr><td><strong>Wildcard</strong></td><td>masque générique</td><td>l’inverse du masque réseau</td></tr>
    <tr><td><strong>Port éphémère</strong></td><td>—</td><td>le port source d’un client, au-dessus de 1023</td></tr>
    <tr><td><strong>ICMP</strong></td><td>Internet Control Message Protocol</td><td>le protocole du ping — sans port, avec des types de message</td></tr>
  </tbody></table>` }),

  note('green', '🔗 Pour aller plus loin', '<p>Cours liés : <a href="/pages/le-pare-feu">Le pare-feu</a> (le concept), <a href="/pages/cisco-nat">NAT / PAT</a> (utilise une ACL), <a href="/pages/cisco-routeur-cli">Configurer un routeur en CLI</a>, <a href="/pages/tcp-et-udp">TCP & UDP</a> (les ports filtrés).</p>'),
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

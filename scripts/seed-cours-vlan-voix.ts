/* Cours « Le VLAN voix (téléphonie IP) » (Réseau / Cisco Packet Tracer).
   Un téléphone IP et un PC sur une seule prise murale : comment deux VLAN
   cohabitent sur un port access, comment le téléphone apprend son VLAN, et
   pourquoi la QoS n'est pas optionnelle sur de la voix.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cours-vlan-voix.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = {
  slug: 'vlan-voix',
  title: 'Le VLAN voix (téléphonie IP)',
  excerpt: 'Un téléphone IP et un PC sur la même prise murale : le port access qui porte deux VLAN, l’apprentissage automatique par CDP/LLDP-MED, l’alimentation PoE et la QoS. Config CLI Cisco, vérifications et dépannage.',
};

const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const styleBlock = block('html', { html: `<style>.vl-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.55}.vl-t{border-collapse:collapse;width:100%;font-size:13px;margin:6px 0}.vl-t th,.vl-t td{border:1px solid var(--border);padding:7px 10px;text-align:left;vertical-align:top}.vl-t th{background:var(--surface-2)}.vl-flow{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:12px;margin:8px 0;white-space:pre;overflow-x:auto;font-size:12px;line-height:1.5}</style>` });
const cmd = (t: string) => block('html', { html: `<div class="vl-cmd">${esc(t)}</div>` });
const flow = (t: string) => block('html', { html: `<div class="vl-flow">${esc(t)}</div>` });

const blocks: PageBlock[] = [
  block('hero', {
    eyebrow: 'Cours · Réseau / Téléphonie',
    title: PAGE.title,
    subtitle: 'Deux VLAN sur une seule prise, et une bonne raison de s’occuper de la QoS.',
  }),
  styleBlock,

  block('html', { html: '<p>Dans un bureau, chaque poste de travail a <strong>une prise réseau</strong> et il en faut désormais <strong>deux appareils</strong> : le PC et le téléphone IP. Retirer les cloisons pour tirer un second câble par bureau coûte cher. La solution retenue partout : le téléphone possède un <strong>petit switch intégré</strong>, on le branche sur la prise, et le PC se branche <strong>derrière le téléphone</strong>.</p>' }),

  flow(`   Prise murale
        │
        ▼
   ┌──────────────┐
   │ Téléphone IP │  ← port SW du switch, alimenté en PoE
   │  (switch 2p) │
   └──────┬───────┘
          │
          ▼
        [ PC ]

   Un seul câble vers le switch, deux appareils, DEUX VLAN.`),

  note('blue', '🎯 Pourquoi séparer la voix des données', '<ul><li><strong>Qualité</strong> : la voix ne supporte ni la latence ni la perte. Un VLAN dédié permet de la <strong>prioriser</strong> sans avoir à trier paquet par paquet.</li><li><strong>Adressage</strong> : les téléphones ont leur propre plage IP et leur propre serveur DHCP (avec les options qui pointent vers l’IPBX).</li><li><strong>Sécurité</strong> : un poste compromis sur le VLAN données ne voit pas la signalisation téléphonique.</li><li><strong>Lisibilité</strong> : sur les compteurs et les captures, on distingue immédiatement ce qui est de la voix.</li></ul>'),

  block('heading', { level: 2, text: '1) Comment deux VLAN tiennent sur un port access' }),
  block('html', { html: '<p>C’est le point qui surprend au début. Le cours <a href="/pages/les-vlan">Les VLAN</a> disait : « un port access appartient à <strong>un seul</strong> VLAN, les trames y circulent <strong>sans étiquette</strong> ». Le VLAN voix est l’<strong>exception</strong> — et elle est cohérente si on regarde qui étiquette quoi.</p>' }),

  block('html', { html: `<table class="vl-t"><thead><tr><th>Émetteur</th><th>Trames</th><th>VLAN d’arrivée</th></tr></thead><tbody>
    <tr><td><strong>Le PC</strong></td><td><strong>Sans étiquette</strong> — le PC ignore tout des VLAN</td><td>VLAN <strong>données</strong> (l’<code>access vlan</code> du port)</td></tr>
    <tr><td><strong>Le téléphone</strong></td><td><strong>Étiquetées 802.1Q</strong> — le téléphone marque lui-même sa voix</td><td>VLAN <strong>voix</strong> (le <code>voice vlan</code> du port)</td></tr>
  </tbody></table>` }),

  note('gray', '💡 Ce n’est donc pas vraiment un trunk', '<p>Le port reste en mode <strong>access</strong>. Il accepte simplement, <strong>en plus</strong>, les trames marquées d’un seul VLAN précis : celui de la voix. On parle parfois de « mini-trunk » ou de <em>multi-VLAN access port</em>. La distinction compte au moment du dépannage : <code>show interfaces trunk</code> <strong>n’affichera pas</strong> ce port.</p>'),

  block('heading', { level: 2, text: '2) La configuration' }),
  cmd(`enable
configure terminal

! Les deux VLAN
vlan 20
 name DONNEES
 exit
vlan 30
 name VOIX
 exit

! Le port du bureau
interface FastEthernet0/5
 switchport mode access
 switchport access vlan 20        ! le PC atterrit ici
 switchport voice vlan 30         ! le téléphone atterrit ici
 switchport nonegotiate
 spanning-tree portfast           ! le port passe direct en forwarding
 exit
end
write memory`),

  note('yellow', '⚡ Pourquoi portfast ici', '<p>Sans <code>portfast</code>, le spanning-tree fait attendre le port ~30 secondes avant de transmettre. Un téléphone qui démarre ne reçoit alors pas son bail DHCP à temps et affiche « Configuring IP » en boucle avant de réessayer. Sur un port qui ne relie qu’un poste terminal, <code>portfast</code> est la bonne configuration — jamais sur un lien entre switches.</p>'),

  block('heading', { level: 2, text: '3) Comment le téléphone apprend son VLAN' }),
  block('html', { html: '<p>Le téléphone ne connaît pas le numéro 30 à l’avance. Le switch le lui <strong>annonce</strong>, par l’un de ces deux protocoles :</p>' }),

  block('html', { html: `<table class="vl-t"><thead><tr><th>Protocole</th><th>Origine</th><th>Remarque</th></tr></thead><tbody>
    <tr><td><strong>CDP</strong></td><td>Cisco (propriétaire)</td><td>Actif par défaut sur les switches Cisco. Fonctionne avec les téléphones Cisco.</td></tr>
    <tr><td><strong>LLDP-MED</strong></td><td>Standard (IEEE 802.1AB)</td><td>À activer explicitement. Indispensable avec des téléphones d’une autre marque (Yealink, Snom, Grandstream…).</td></tr>
  </tbody></table>` }),

  cmd(`! Activer LLDP-MED si les téléphones ne sont pas des Cisco
lldp run                     ! en configuration globale

interface FastEthernet0/5
 lldp transmit
 lldp receive
 exit`),

  flow(`Séquence de démarrage d'un téléphone IP

  1. Le téléphone s'allume (alimenté en PoE par le switch)
  2. Il écoute CDP / LLDP-MED         → "ta voix va dans le VLAN 30"
  3. Il émet un DHCP DISCOVER étiqueté VLAN 30
  4. Il reçoit IP + masque + passerelle + option 66/150 (adresse de l'IPBX)
  5. Il contacte l'IPBX et télécharge sa configuration
  6. Il est prêt — le PC branché derrière, lui, reste sur le VLAN 20`),

  note('gray', '📞 L’option DHCP 150', '<p>C’est l’option Cisco qui indique au téléphone <strong>où trouver son serveur d’appels</strong> (TFTP / IPBX). Les constructeurs standards utilisent plutôt l’option <strong>66</strong>. Un téléphone qui obtient bien une IP mais reste bloqué sur « Registering » a presque toujours un problème d’option 66/150, pas de VLAN.</p>'),

  block('heading', { level: 2, text: '4) L’alimentation PoE' }),
  block('html', { html: '<p>Le téléphone est alimenté par le câble réseau : c’est le <strong>PoE</strong> (<em>Power over Ethernet</em>). Encore faut-il que le switch ait le budget électrique nécessaire.</p>' }),

  block('html', { html: `<table class="vl-t"><thead><tr><th>Norme</th><th>Puissance par port</th><th>Usage typique</th></tr></thead><tbody>
    <tr><td>802.3af (PoE)</td><td>~15,4 W</td><td>Téléphone IP, point d’accès simple</td></tr>
    <tr><td>802.3at (PoE+)</td><td>~30 W</td><td>Point d’accès Wi-Fi récent, caméra motorisée</td></tr>
    <tr><td>802.3bt (PoE++)</td><td>~60 à 90 W</td><td>Écran, borne, éclairage</td></tr>
  </tbody></table>` }),

  cmd(`show power inline              ! budget total et consommation par port
show power inline Fa0/5        ! détail d'un port`),

  note('yellow', '🔌 Le piège du budget PoE', '<p>Un switch 48 ports annoncé « PoE » n’a pas forcément de quoi alimenter <strong>48 appareils à pleine charge</strong>. Le budget est global (par exemple 370 W). Les derniers téléphones branchés restent alors éteints, sans message d’erreur évident. <code>show power inline</code> montre immédiatement le budget restant.</p>'),

  block('heading', { level: 2, text: '5) La QoS — la voix ne se rattrape pas' }),
  block('html', { html: '<p>Un fichier qui arrive avec 200 ms de retard, personne ne le remarque. Une conversation avec 200 ms de retard devient inutilisable. La voix impose des contraintes strictes :</p>' }),

  block('html', { html: `<table class="vl-t"><thead><tr><th>Critère</th><th>Seuil acceptable</th><th>Au-delà</th></tr></thead><tbody>
    <tr><td>Latence (aller simple)</td><td>&lt; 150 ms</td><td>On se coupe la parole</td></tr>
    <tr><td>Gigue (variation de latence)</td><td>&lt; 30 ms</td><td>Voix hachée, robotique</td></tr>
    <tr><td>Perte de paquets</td><td>&lt; 1 %</td><td>Syllabes manquantes</td></tr>
  </tbody></table>` }),

  block('html', { html: '<p>Le VLAN voix sert justement de <strong>critère de tri</strong> : tout ce qui en vient est prioritaire. Sur un switch Cisco, on fait confiance au marquage du téléphone plutôt que de reclasser soi-même :</p>' }),

  cmd(`interface FastEthernet0/5
 mls qos trust device cisco-phone   ! fait confiance au marquage du téléphone
 mls qos trust cos                  ! ...mais uniquement s'il est bien là
 exit`),

  note('blue', '🎯 Faire confiance, mais pas à tout le monde', '<p><code>trust device cisco-phone</code> signifie : « je respecte les priorités <strong>si</strong> un téléphone Cisco est bien détecté par CDP ; sinon je remets tout à zéro ». Sans cette condition, n’importe quel PC pourrait marquer son trafic comme prioritaire et passer devant la voix. C’est le même raisonnement que pour le VLAN natif dans <a href="/pages/vlan-securite">Sécuriser les VLAN</a> : on ne fait jamais confiance à ce que l’équipement terminal déclare.</p>'),

  block('heading', { level: 2, text: '6) Vérifier' }),
  cmd(`show interfaces Fa0/5 switchport   ! doit montrer Access Mode VLAN 20
                                   ! et Voice VLAN 30
show vlan brief                    ! les deux VLAN existent et ont des ports
show cdp neighbors                 ! le téléphone est-il vu par le switch ?
show lldp neighbors                ! idem en LLDP (téléphones non-Cisco)
show power inline                  ! le téléphone est-il alimenté ?
show mac address-table interface Fa0/5   ! 2 MAC : une par VLAN`),

  note('green', '✅ La vérification qui résume tout', '<p><code>show mac address-table interface Fa0/5</code> doit afficher <strong>deux adresses MAC</strong> : celle du téléphone dans le VLAN 30, celle du PC dans le VLAN 20. Si tu n’en vois qu’une, tu sais immédiatement lequel des deux ne passe pas.</p>'),

  block('heading', { level: 2, text: '7) Dépannage courant' }),
  block('html', { html: `<table class="vl-t"><thead><tr><th>Symptôme</th><th>Piste</th></tr></thead><tbody>
    <tr><td>Le téléphone reste éteint</td><td>PoE : budget épuisé, ou port sans PoE. <code>show power inline</code>.</td></tr>
    <tr><td>Le téléphone démarre mais n’obtient pas d’IP</td><td>VLAN voix absent du switch, ou DHCP injoignable depuis ce VLAN (relais <code>ip helper-address</code> manquant sur la passerelle).</td></tr>
    <tr><td>IP obtenue, mais « Registering » sans fin</td><td>Option DHCP 66/150 absente ou fausse : le téléphone ne trouve pas l’IPBX.</td></tr>
    <tr><td>Le téléphone marche, mais pas le PC derrière</td><td><code>switchport access vlan</code> oublié, ou <code>port-security maximum 1</code> : il faut <strong>au moins 2</strong> MAC sur ce port.</td></tr>
    <tr><td>Voix hachée aux heures de pointe</td><td>QoS non configurée, ou lien de collecte saturé. Vérifier le <code>trust</code> et la charge des trunks.</td></tr>
    <tr><td>Téléphone non-Cisco jamais détecté</td><td>CDP seul ne suffit pas : activer <code>lldp run</code>.</td></tr>
  </tbody></table>` }),

  note('yellow', '🛠️ Le classique du port-security', '<p>Si le port applique <code>switchport port-security maximum 1</code> (voir <a href="/pages/vlan-securite">Sécuriser les VLAN</a>), le téléphone occupe l’unique place autorisée et le PC déclenche une violation. Sur un port avec téléphone, le minimum est <strong>2</strong> — souvent <strong>3</strong> pour tolérer un changement de poste sans intervention.</p>'),

  note('green', '🔗 Pour aller plus loin', '<p>Cours liés : <a href="/pages/les-vlan">Les VLAN &amp; le routage inter-VLAN</a>, <a href="/pages/vlan-securite">Sécuriser les VLAN</a>, <a href="/pages/vlan-vtp">VTP</a>, <a href="/pages/le-switch">Le switch</a>. Procédure : <a href="/pages/procedure-dhcp-packet-tracer">Configurer un serveur DHCP sur Packet Tracer</a>. Outil : <a href="/pages/atelier-reseau">Atelier Réseau</a>.</p>'),
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

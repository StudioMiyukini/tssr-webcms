/* Cours « Wireshark : capturer et analyser une trame » (Réseau).
   Basé sur le TP « Analyse d'une trame informatique » : capture d'un ping (routeur puis domaine),
   ARP/ICMP/DNS, encapsulation & OSI, relation MAC/IP (hop-by-hop vs bout-en-bout), ports UDP, hexa/ASCII.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cours-wireshark.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = { slug: 'le-wireshark', title: 'Wireshark : capturer et analyser une trame', excerpt: 'Analyseur de protocoles : capturer le trafic, filtrer, lire une trame (les 3 volets), comprendre l’encapsulation Ethernet/IP/ICMP/UDP/DNS et le modèle OSI, la relation MAC/IP (hop-by-hop vs bout-en-bout), les ports et le décodage hexadécimal/ASCII. Avec un TP guidé (ping routeur puis nom de domaine).' };
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const styleBlock = block('html', { html: `<style>.ws-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.55}.ws-t{border-collapse:collapse;width:100%;font-size:13px;margin:6px 0}.ws-t th,.ws-t td{border:1px solid var(--border);padding:7px 10px;text-align:left;vertical-align:top}.ws-t th{background:var(--surface-2)}.ws-mono{font-family:ui-monospace,monospace}.ws-enc{margin:10px 0}.ws-lyr{border-radius:8px;padding:8px 12px;color:#fff;font-weight:600;font-size:12.5px;margin:0}.ws-lyr small{display:block;font-weight:400;opacity:.9;font-size:11px}</style>` });
const cmd = (t: string) => block('html', { html: `<div class="ws-cmd">${esc(t)}</div>` });

// Table ASCII imprimable (32–126) rendue en grille compacte.
const asciiRows = (() => {
  const cells: string[] = [];
  for (let n = 32; n <= 126; n++) {
    const ch = n === 32 ? 'SP' : String.fromCharCode(n);
    cells.push(`<td class="ws-mono">${n}</td><td class="ws-mono">${n.toString(16).toUpperCase().padStart(2, '0')}</td><td class="ws-mono">${esc(ch)}</td>`);
  }
  // 5 colonnes de (déc, hex, car)
  const perCol = Math.ceil(cells.length / 5);
  let rows = '';
  for (let r = 0; r < perCol; r++) {
    rows += '<tr>';
    for (let c = 0; c < 5; c++) { const i = c * perCol + r; rows += cells[i] || '<td></td><td></td><td></td>'; }
    rows += '</tr>';
  }
  return rows;
})();

const toHex = (s: string) => [...s].map(c => c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')).join(' ');
const dnsName = (host: string) => host.split('.').map(l => `${l.length.toString(16).padStart(2, '0')} ${toHex(l).toLowerCase()}`).join('  ') + '  00';

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Réseau', title: PAGE.title, subtitle: 'Ouvrir le capot du réseau : voir, octet par octet, comment deux machines dialoguent.' }),
  styleBlock,
  block('html', { html: '<p><strong>Wireshark</strong> est un <strong>analyseur de protocoles réseau</strong> (un « sniffer ») : il <strong>capture</strong> les trames qui passent sur une carte réseau et les <strong>décode</strong> couche par couche. C’est l’outil de référence pour <strong>comprendre</strong> un échange, <strong>apprendre</strong> les protocoles et <strong>dépanner</strong> (voir <em>vraiment</em> ce qui circule, au lieu de le supposer).</p>' }),
  note('yellow', '⚖️ Cadre légal', '<p>Ne capture que sur un réseau qui t’appartient ou pour lequel tu as une <strong>autorisation</strong>. Écouter le trafic d’autrui est illégal. En TP/labo, tu captures ton propre poste : aucun souci.</p>'),

  block('heading', { level: 2, text: '1) Avant de capturer : connaître son poste' }),
  block('html', { html: '<p>Une trame se lit avec ses <strong>adresses</strong>. Relève d’abord les tiennes en invite de commande :</p>' }),
  cmd('ipconfig /all'),
  block('html', { html: '<p>Note l’<strong>adresse MAC</strong> (adresse physique, ex. <code>00-1A-2B-3C-4D-5E</code>), l’<strong>adresse IP</strong>, le <strong>serveur DHCP</strong> et la <strong>passerelle par défaut</strong>. Tu les reconnaîtras dans Wireshark.</p>' }),
  note('blue', '❓ D’où viennent ces adresses', '<ul><li>La <strong>MAC</strong> est <strong>gravée dans la carte réseau</strong> par le fabricant (les 3 premiers octets = l’<strong>OUI</strong> du constructeur). Elle identifie le matériel sur le réseau <em>local</em>.</li><li>L’<strong>IP</strong> est <strong>attribuée</strong> — le plus souvent par le <strong>DHCP</strong> (bail), sinon fixée à la main. Elle situe la machine dans un <em>réseau logique</em>.</li></ul>'),

  block('heading', { level: 2, text: '2) L’interface Wireshark : trois volets' }),
  block('html', { html: '<p>Une fois une capture ouverte, l’écran se lit en <strong>trois blocs</strong> de haut en bas :</p>' }),
  block('html', { html: `<table class="ws-t"><thead><tr><th>Volet</th><th>Contenu</th></tr></thead><tbody>
    <tr><td><strong>Liste des paquets</strong></td><td>une ligne par trame : n°, temps, IP source/destination, protocole, résumé (ex. <em>Echo (ping) request</em>).</td></tr>
    <tr><td><strong>Détails (arbre)</strong></td><td>la trame <strong>décodée couche par couche</strong> : Ethernet → IP → ICMP/UDP → DNS… On déplie chaque couche pour voir ses champs.</td></tr>
    <tr><td><strong>Octets (hexadécimal)</strong></td><td>le contenu <strong>brut</strong> de la trame en hexa + ASCII. Cliquer un champ dans l’arbre <strong>surligne</strong> les octets correspondants.</td></tr>
  </tbody></table>` }),

  block('heading', { level: 2, text: '3) Lancer une capture' }),
  block('html', { html: '<ol class="proc-steps"><li>Menu <strong>Capture → Options</strong>.</li><li>Repérer la <strong>bonne interface</strong> (celle qui a du trafic / ton IP).</li><li>Décocher <strong>« Capture packets in promiscuous mode »</strong> pour ne voir que <em>ton</em> trafic (le mode promiscuous capturerait aussi les trames destinées à d’autres, sur un réseau qui le permet).</li><li><strong>Start</strong>, générer le trafic à observer, puis <strong>Stop</strong>. Sauvegarder avec <strong>File → Save</strong> (fichier <code>.pcapng</code>).</li></ol>' }),
  note('gray', '🎯 Filtre de capture vs filtre d’affichage', '<p>Le <strong>filtre de capture</strong> (avant de démarrer) limite ce qui est <em>enregistré</em>. Le <strong>filtre d’affichage</strong> (barre du haut, après capture) limite ce qui est <em>montré</em> — c’est celui qu’on utilise le plus. Exemples : <code>ip.addr == 192.168.50.254</code>, <code>arp</code>, <code>icmp</code>, <code>dns</code>, <code>udp.port == 53</code>. On combine avec <code>&&</code> (et), <code>||</code> (ou).</p>'),

  block('heading', { level: 2, text: '4) Cas nº 1 — pinguer la passerelle (ARP + ICMP)' }),
  block('html', { html: '<p>Prépare un petit script <code>test_router.bat</code> pour repartir de zéro (on vide le cache ARP) et générer un seul ping :</p>' }),
  cmd('arp -d *\nping 192.168.50.254 -n 1\npause'),
  block('html', { html: '<p>Lance la capture, exécute le .bat, arrête. Filtre sur l’IP de la passerelle : <strong>4 trames</strong> apparaissent. Elles répondent chacune à un besoin :</p>' }),
  block('html', { html: `<table class="ws-t"><thead><tr><th>Nº</th><th>Protocole</th><th>Sens</th><th>Rôle</th></tr></thead><tbody>
    <tr><td>1</td><td><strong>ARP</strong> — <em>Who has 192.168.50.254 ? Tell &lt;moi&gt;</em></td><td>émise (broadcast)</td><td>« Qui a cette IP ? Donne-moi ta MAC. » Je ne connais pas encore la MAC de la passerelle.</td></tr>
    <tr><td>2</td><td><strong>ARP</strong> — <em>192.168.50.254 is at aa:bb:cc:…</em></td><td>reçue</td><td>La passerelle répond avec sa <strong>MAC</strong>. Je peux maintenant lui parler.</td></tr>
    <tr><td>3</td><td><strong>ICMP</strong> — <em>Echo (ping) request</em></td><td>émise</td><td>La demande de ping proprement dite, envoyée à la MAC obtenue.</td></tr>
    <tr><td>4</td><td><strong>ICMP</strong> — <em>Echo (ping) reply</em></td><td>reçue</td><td>La passerelle répond : elle est joignable.</td></tr>
  </tbody></table>` }),
  note('blue', '📡 Le broadcast ARP', '<p>Dans la trame ARP « Who has », la <strong>MAC de destination</strong> est <code>ff:ff:ff:ff:ff:ff</code> = <strong>broadcast</strong> : le message est envoyé à <strong>tout le monde</strong> sur le réseau local, car on ignore encore à qui appartient l’IP recherchée. Seule la machine concernée répond.</p>'),
  note('gray', '🧠 À retenir (échange local)', '<p>Sur le <strong>même réseau</strong>, pour joindre une IP il faut d’abord sa <strong>MAC</strong> → c’est le rôle d’<strong>ARP</strong>. La trame ICMP part ensuite directement vers cette MAC. Source = ta MAC / ton IP ; destination = MAC / IP de la passerelle.</p>'),

  block('heading', { level: 2, text: '5) Cas nº 2 — pinguer un nom de domaine (DNS + ARP + ICMP)' }),
  block('html', { html: '<p>Cette fois on vide le cache DNS et on ping un <strong>nom</strong> :</p>' }),
  cmd('ipconfig /flushdns\nping www.adrar-formation.com -n 1\npause'),
  block('html', { html: '<p>Avant de pouvoir pinguer, la machine doit <strong>traduire le nom en IP</strong> : c’est le <strong>DNS</strong>. On voit apparaître deux trames DNS supplémentaires :</p>' }),
  block('html', { html: `<table class="ws-t"><thead><tr><th>Trame</th><th>Sens</th><th>Rôle</th></tr></thead><tbody>
    <tr><td><strong>DNS Standard query A</strong> www.adrar-formation.com</td><td>émise → serveur DNS</td><td>« Quelle est l’adresse IP (enregistrement A) de ce nom ? »</td></tr>
    <tr><td><strong>DNS Standard response A</strong> …</td><td>reçue ← serveur DNS</td><td>Le serveur DNS renvoie l’<strong>IP</strong> du site. La machine peut enfin construire le ping.</td></tr>
  </tbody></table>` }),
  note('yellow', '🧭 La grande leçon : MAC ≠ IP de destination', '<p>Le site <code>www.adrar-formation.com</code> est <strong>hors de ton réseau local</strong> (compare avec ton masque). Dans la trame envoyée :</p><ul><li>l’<strong>IP de destination</strong> est bien celle du <strong>site</strong> (adresse <em>de bout en bout</em>, couche 3, ne change pas de A à Z) ;</li><li>mais la <strong>MAC de destination</strong> est celle de la <strong>passerelle</strong> (adresse <em>du prochain saut</em>, couche 2, change à chaque routeur).</li></ul><p>Autrement dit : <strong>IP = destination finale, MAC = prochaine étape</strong>. C’est le principe le plus important de l’analyse de trames.</p>'),

  block('heading', { level: 2, text: '6) L’encapsulation' }),
  block('html', { html: '<p>Chaque protocole <strong>emballe</strong> celui du dessus dans son propre en-tête. Wireshark montre ces « poupées russes » dans l’arbre de détails :</p>' }),
  block('html', { html: `<div class="ws-enc">
    <div class="ws-lyr" style="background:#0891b2">Ethernet (MAC src/dst, type)<small>Trame — couche liaison</small>
      <div class="ws-lyr" style="background:#059669;margin-top:6px">IP (IP src/dst, TTL, protocole)<small>Paquet — couche réseau</small>
        <div class="ws-lyr" style="background:#7c3aed;margin-top:6px">UDP (port src/dst) <small>Segment — couche transport</small>
          <div class="ws-lyr" style="background:#ea580c;margin-top:6px">DNS (question / réponse)<small>Données — couche application</small></div>
        </div>
      </div>
    </div>
  </div>` }),
  block('html', { html: '<p>Selon la trame, le contenu change : un <strong>ping</strong> encapsule <code>Ethernet → IP → ICMP</code> (ICMP est directement dans IP, sans couche transport). Une résolution de nom encapsule <code>Ethernet → IP → UDP → DNS</code>. Et <strong>ARP</strong> est un cas à part : il est porté <strong>directement dans Ethernet</strong> (il ne passe pas par IP).</p>' }),
  block('html', { html: `<table class="ws-t"><thead><tr><th>Couche OSI</th><th>Protocole (dans nos trames)</th><th>Adresse / info clé</th></tr></thead><tbody>
    <tr><td>7 · Application</td><td><strong>DNS</strong> (HTTP, etc.)</td><td>nom demandé, réponse</td></tr>
    <tr><td>4 · Transport</td><td><strong>UDP</strong> (ou TCP)</td><td>ports source / destination</td></tr>
    <tr><td>3 · Réseau</td><td><strong>IP</strong> (+ <strong>ICMP</strong>)</td><td>IP source / destination</td></tr>
    <tr><td>2 · Liaison</td><td><strong>Ethernet</strong> · <strong>ARP</strong></td><td>MAC source / destination</td></tr>
    <tr><td>1 · Physique</td><td>—</td><td>bits sur le câble</td></tr>
  </tbody></table>` }),
  note('gray', '🔤 Les sigles', '<p><strong>ARP</strong> = <em>Address Resolution Protocol</em> (IP → MAC) · <strong>IP</strong> = <em>Internet Protocol</em> · <strong>UDP</strong> = <em>User Datagram Protocol</em> · <strong>ICMP</strong> = <em>Internet Control Message Protocol</em>. Détails dans le cours <a href="/pages/les-7-couches-osi">Les 7 couches OSI</a>.</p>'),

  block('heading', { level: 2, text: '7) Les ports (UDP) et le DNS' }),
  block('html', { html: '<p>Dans la couche <strong>UDP</strong> de la requête DNS, relève le <strong>port source</strong> et le <strong>port destination</strong> :</p><ul><li><strong>Requête</strong> : port source = un <strong>port éphémère</strong> choisi par le client (&gt; 1023), port destination = <strong>53</strong> (port bien connu du DNS).</li><li><strong>Réponse</strong> : les deux ports sont <strong>permutés</strong> (source 53, destination = le port éphémère du client).</li></ul><p>La permutation est logique : la réponse <strong>revient</strong> vers celui qui a demandé, sur le même « canal ». Le port <strong>53</strong> identifie le service DNS côté serveur (à retenir).</p>' }),

  block('heading', { level: 2, text: '8) Décoder en hexadécimal (nom de domaine)' }),
  block('html', { html: '<p>Dans le volet des octets, tout est en <strong>hexadécimal</strong>. Chaque caractère du nom de domaine est un octet <strong>ASCII</strong>. Exemple pour les labels de <code>www.adrar-formation.com</code> :</p>' }),
  block('html', { html: `<table class="ws-t"><thead><tr><th>Label</th><th>ASCII → hexadécimal</th></tr></thead><tbody>
    <tr><td class="ws-mono">www</td><td class="ws-mono">${toHex('www')}</td></tr>
    <tr><td class="ws-mono">adrar-formation</td><td class="ws-mono">${toHex('adrar-formation')}</td></tr>
    <tr><td class="ws-mono">com</td><td class="ws-mono">${toHex('com')}</td></tr>
  </tbody></table>` }),
  note('blue', '🔎 Comment le nom apparaît vraiment dans la trame', `<p>Le DNS ne stocke pas les points : chaque label est <strong>précédé de sa longueur</strong> et le nom se termine par <code>00</code>. Dans la trame, tu trouveras donc :</p><div class="ws-cmd">${dnsName('www.adrar-formation.com')}</div><p>(<code>03</code> = « 3 caractères » avant <code>www</code>, <code>0f</code> = 15 avant <code>adrar-formation</code>, <code>03</code> avant <code>com</code>, puis <code>00</code>.) Sélectionne le champ <em>Name</em> dans l’arbre : Wireshark surligne exactement ces octets.</p>`),

  note('blue', '🛠️ Outil', '<p>Pour décoder rapidement un dump hexa (le contenu ASCII d’une trame, un en-tête <code>Authorization: Basic</code> en Base64…) : <a href="/pages/convertisseur-hexa">Convertisseur hexadécimal ↔ texte / décimal</a>.</p>'),

  block('heading', { level: 2, text: '🧪 TP guidé (récap)' }),
  block('html', { html: '<ol class="proc-steps"><li>Relever sa config : <code>ipconfig /all</code> (MAC, IP, DHCP, passerelle).</li><li>Capturer le ping de la <strong>passerelle</strong> via <code>test_router.bat</code> → filtrer <code>ip.addr == 192.168.50.254</code> → identifier ARP×2 + ICMP×2.</li><li>Capturer le ping d’un <strong>nom</strong> via <code>ipconfig /flushdns</code> + <code>ping www.adrar-formation.com -n 1</code> → filtrer sur ton IP → identifier DNS query/response, puis ICMP.</li><li>Ouvrir une trame (double-clic) et localiser : MAC/IP source et destination, l’encapsulation, les ports UDP, le nom en hexa.</li><li>Conclure : rôle d’ARP, du DNS, et la différence <strong>MAC (prochain saut) / IP (destination finale)</strong>.</li></ol>' }),
  note('gray', '🛠️ Commandes utiles', '<p><code>arp -d *</code> vide le cache ARP · <code>ipconfig /flushdns</code> vide le cache DNS · <code>ping &lt;cible&gt; -n 1</code> envoie <strong>un seul</strong> ping (capture plus lisible).</p>'),

  block('heading', { level: 3, text: '📎 Annexe — table ASCII imprimable (32–126)' }),
  block('html', { html: `<table class="ws-t" style="font-size:11.5px">${asciiRows}</table>` }),

  note('green', '🔗 Pour aller plus loin', '<p>Cours liés : <a href="/pages/les-7-couches-osi">Les 7 couches OSI</a>, <a href="/pages/adresses-ip">Les adresses IP</a>, <a href="/pages/adresses-mac">Les adresses MAC</a>, <a href="/pages/ip-et-binaire">IP & binaire</a>, <a href="/pages/tcp-et-udp">TCP & UDP</a>, <a href="/pages/notions-complementaires">Notions clés (DNS, ARP…)</a>.</p>'),
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

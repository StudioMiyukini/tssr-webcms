/* Lot de procédures « à suivre » pour les TP / la Réalisation (site accessible le jour J) :
   - procedure-plan-adressage    : découper un réseau selon le besoin en hôtes (VLSM)
   - procedure-ip-fixe-windows   : configurer une IP statique (Windows 10/11 & Server)
   - procedure-renommer-poste    : renommer un poste Windows (convention de nommage)
   - procedure-test-connectivite : dépannage réseau méthodique (loopback → passerelle → DNS)
   Convention respectée : passerelle par défaut en .254 (cmd/netsh — PowerShell interdit en TP).
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-procedures-tp.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const stepsStyle = block('html', { html: `<style>.proc-steps{padding-left:22px;line-height:1.75}.proc-steps>li{margin:7px 0}.proc-steps code,.proc-steps kbd{font-family:ui-monospace,'Space Mono',monospace}.proc-steps kbd{border:1px solid var(--border);border-radius:5px;padding:1px 6px;background:var(--surface-2)}.proc-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto}</style>` });
const cmd = (t: string) => block('html', { html: `<div class="proc-cmd">${t}</div>` });

type Page = { slug: string; title: string; excerpt: string; blocks: PageBlock[] };

// ===================================================================================
// 1) PLAN D'ADRESSAGE (VLSM)
// ===================================================================================
const planAdressage: Page = {
  slug: 'procedure-plan-adressage',
  title: 'Plan d’adressage (découpage en sous-réseaux)',
  excerpt: 'Procédure VLSM : découper un réseau en sous-réseaux à partir du besoin en hôtes de chaque service, sans chevauchement.',
  blocks: [
    block('hero', { eyebrow: 'Procédure · Réseau', title: 'Plan d’adressage (VLSM)', subtitle: 'Découper un réseau en sous-réseaux à partir du besoin en hôtes de chaque service.' }),
    stepsStyle,
    note('blue', '🎯 Le principe (VLSM)', '<p>On te donne un réseau (ex. <code>192.168.10.0/24</code>) et une liste de services avec un <strong>besoin en hôtes</strong> chacun. But : attribuer à chaque service le <strong>plus petit bloc suffisant</strong>, en commençant par le <strong>plus gros besoin</strong>, sans chevauchement. C’est le <strong>VLSM</strong> (masques de longueur variable).</p>'),
    block('heading', { level: 2, text: '📋 La procédure à suivre' }),
    block('html', { html: `<ol class="proc-steps">
      <li><strong>Liste</strong> les sous-réseaux nécessaires avec leur besoin en hôtes (n’oublie pas les liaisons routeur↔routeur = 2 hôtes).</li>
      <li><strong>Trie</strong> du plus grand besoin au plus petit.</li>
      <li>Pour chaque service, trouve le <strong>CIDR</strong> : le plus petit nombre de bits hôtes <code>n</code> tel que <code>2^n − 2 ≥ besoin</code>. Alors <code>CIDR = 32 − n</code> et la <strong>taille du bloc</strong> = <code>2^n</code> (voir tableau).</li>
      <li><strong>Attribue les blocs</strong> à la suite depuis le début de la plage, chaque bloc <strong>aligné sur sa taille</strong> (l’adresse réseau doit être un multiple de la taille du bloc).</li>
      <li>Pour chaque sous-réseau, note : <strong>adresse réseau</strong>, <strong>1re / dernière IP utilisable</strong>, <strong>broadcast</strong>, <strong>masque</strong>, <strong>passerelle</strong> et <strong>nb d’hôtes</strong>.</li>
    </ol>` }),
    block('html', { html: `<div style="overflow-x:auto;margin:8px 0 14px"><table style="border-collapse:collapse;width:100%;min-width:560px;font-size:13.5px" class="ref-table"><thead><tr style="background:var(--surface-2)">${['Besoin en hôtes', 'Bits hôtes (n)', 'CIDR', 'Taille du bloc', 'Hôtes utilisables'].map(h => `<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">${h}</th>`).join('')}</tr></thead><tbody>`
      + [1, 2, 3, 4, 5, 6, 7, 8].map(n => { const size = Math.pow(2, n); const use = size - 2; const cidr = 32 - n; return `<tr><td>≤ ${use}</td><td>${n}</td><td>/${cidr}</td><td>${size}</td><td>${use}</td></tr>`; }).join('')
      + `</tbody></table></div><style>.ref-table td{padding:7px 10px;border:1px solid var(--border);font-family:ui-monospace,'Space Mono',monospace}.ref-table td:nth-child(3){font-weight:700;color:var(--accent)}</style>` }),
    block('heading', { level: 2, text: '✍️ Exemple résolu — 192.168.10.0/24' }),
    block('html', { html: '<p>Services à raccorder : <strong>Production 100</strong>, <strong>Bureaux 50</strong>, <strong>Wi-Fi 20</strong>, <strong>Liaison 2</strong>.</p>' }),
    block('html', { html: `<div style="overflow-x:auto;margin:8px 0 14px"><table style="border-collapse:collapse;width:100%;min-width:680px;font-size:13px" class="ref-table"><thead><tr style="background:var(--surface-2)">${['Service', 'Besoin', 'CIDR', 'Réseau', 'Plage utilisable', 'Broadcast', 'Passerelle'].map(h => `<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">${h}</th>`).join('')}</tr></thead><tbody>`
      + [
        ['Production', '100', '/25', '192.168.10.0', '.1 → .126', '192.168.10.127', '192.168.10.126'],
        ['Bureaux', '50', '/26', '192.168.10.128', '.129 → .190', '192.168.10.191', '192.168.10.190'],
        ['Wi-Fi', '20', '/27', '192.168.10.192', '.193 → .222', '192.168.10.223', '192.168.10.222'],
        ['Liaison', '2', '/30', '192.168.10.224', '.225 → .226', '192.168.10.227', '—'],
      ].map(r => `<tr>${r.map((c, i) => `<td${i === 0 ? ' style="font-weight:600"' : ''}>${c}</td>`).join('')}</tr>`).join('')
      + `</tbody></table></div>` }),
    note('yellow', '⚠️ À vérifier', '<ul><li>Chaque bloc commence à un <strong>multiple de sa taille</strong> (0, 128, 192, 224…) : jamais de chevauchement.</li><li>La <strong>passerelle</strong> est par convention la <strong>dernière IP utilisable</strong> du sous-réseau (ou <code>.254</code> sur un <code>/24</code> complet) — respecte la consigne du sujet.</li><li>Commence toujours par le <strong>plus gros</strong> besoin, sinon tu fragmentes la plage.</li></ul>'),
    note('green', '🔗 Liens utiles', '<p><a href="/trouver-plage-ip-cidr">Trouver une plage d’IP (méthode + exerciseur)</a> · <a href="/segmentation-sous-reseaux">La segmentation (subnetting)</a></p>'),
  ],
};

// ===================================================================================
// 2) IP FIXE WINDOWS
// ===================================================================================
const ipFixe: Page = {
  slug: 'procedure-ip-fixe-windows',
  title: 'Configurer une IP fixe (Windows 10/11 & Server)',
  excerpt: 'Attribuer une adresse IP statique sous Windows : méthode graphique (ncpa.cpl) et méthode en ligne de commande (netsh).',
  blocks: [
    block('hero', { eyebrow: 'Procédure · Réseau', title: 'Configurer une IP fixe (Windows)', subtitle: 'Adresse IP statique sur Windows 10/11 et Windows Server — interface graphique et cmd.' }),
    stepsStyle,
    note('blue', 'ℹ️ Avant de commencer', '<p>Prépare tes valeurs : <strong>adresse IP</strong>, <strong>masque</strong>, <strong>passerelle</strong> (convention <code>.254</code>) et <strong>DNS</strong>. Sur un <strong>serveur DC/DNS</strong>, le DNS préféré pointe vers <strong>lui-même</strong> ; sur un <strong>client</strong>, le DNS préféré est l’<strong>IP du contrôleur de domaine</strong> (jamais la box, sinon la résolution du domaine échoue).</p>'),
    block('heading', { level: 2, text: '🖱️ Méthode graphique (recommandée)' }),
    block('html', { html: `<ol class="proc-steps">
      <li>Ouvre les connexions réseau : <kbd>Win</kbd>+<kbd>R</kbd> → tape <code>ncpa.cpl</code> → <kbd>Entrée</kbd>.</li>
      <li><strong>Clic droit</strong> sur la carte <em>Ethernet</em> → <strong>Propriétés</strong>.</li>
      <li>Sélectionne <strong>« Protocole Internet version 4 (TCP/IPv4) »</strong> → <strong>Propriétés</strong>.</li>
      <li>Coche <strong>« Utiliser l’adresse IP suivante »</strong> et saisis : <strong>Adresse IP</strong>, <strong>Masque de sous-réseau</strong>, <strong>Passerelle par défaut</strong> (<code>.254</code>).</li>
      <li>Coche <strong>« Utiliser l’adresse de serveur DNS suivante »</strong> et saisis le <strong>DNS préféré</strong> (IP du DC).</li>
      <li><strong>OK</strong> → <strong>Fermer</strong>.</li>
    </ol>` }),
    block('heading', { level: 2, text: '⌨️ Méthode en ligne de commande (netsh)' }),
    block('html', { html: '<p>Invite de commandes <strong>en administrateur</strong> (adapte le nom de la carte, ici <code>Ethernet</code>) :</p>' }),
    cmd('netsh interface ip set address name="Ethernet" static 192.168.10.10 255.255.255.0 192.168.10.254\nnetsh interface ip set dns    name="Ethernet" static 192.168.10.1'),
    block('heading', { level: 2, text: '✅ Vérifier' }),
    cmd('ipconfig /all\nping 192.168.10.254'),
    block('html', { html: '<p>Contrôle que l’IP, le masque, la passerelle et le DNS sont corrects, puis que la passerelle répond au ping. Si le ping échoue mais la config est bonne → voir le <a href="/procedure-test-connectivite">test de connectivité méthodique</a> et l’<a href="/astuce-pare-feu-ping">autorisation du ping (pare-feu)</a>.</p>' }),
    note('yellow', '⚠️ Piège', '<p>Une IP en <code>169.254.x.x</code> (<strong>APIPA</strong>) = la carte n’a <strong>pas</strong> reçu de configuration valide (DHCP absent ou IP statique non appliquée).</p>'),
  ],
};

// ===================================================================================
// 3) RENOMMER UN POSTE
// ===================================================================================
const renommer: Page = {
  slug: 'procedure-renommer-poste',
  title: 'Renommer un poste Windows',
  excerpt: 'Changer le nom d’un ordinateur ou d’un serveur Windows en respectant la convention de nommage, puis redémarrer.',
  blocks: [
    block('hero', { eyebrow: 'Procédure · Windows', title: 'Renommer un poste Windows', subtitle: 'Changer le nom d’un PC ou d’un serveur — à faire AVANT de joindre le domaine.' }),
    stepsStyle,
    note('blue', '🏷️ Convention de nommage', '<p>Respecte la convention imposée par le sujet (souvent un préfixe par type + n° : <code>SRV-AD01</code>, <code>PC-COMPTA-01</code>…). Un nom clair = des points faciles et un annuaire lisible. <strong>Renomme toujours AVANT de joindre le domaine.</strong></p>'),
    block('heading', { level: 2, text: '🖱️ Méthode graphique' }),
    block('html', { html: `<ol class="proc-steps">
      <li><kbd>Win</kbd>+<kbd>R</kbd> → <code>sysdm.cpl</code> → <kbd>Entrée</kbd> (Propriétés système).</li>
      <li>Onglet <strong>« Nom de l’ordinateur »</strong> → bouton <strong>« Modifier… »</strong>.</li>
      <li>Saisis le <strong>nouveau nom</strong> (selon la convention) → <strong>OK</strong>.</li>
      <li>Windows demande un <strong>redémarrage</strong> : accepte et <strong>redémarre</strong>.</li>
    </ol>` }),
    block('html', { html: '<p><em>Windows 11 (alternative)</em> : Paramètres → <strong>Système</strong> → <strong>Informations système</strong> → <strong>Renommer ce PC</strong>.</p>' }),
    block('heading', { level: 2, text: '⌨️ En ligne de commande (cmd admin)' }),
    cmd('netdom renamecomputer %COMPUTERNAME% /newname:SRV-AD01\nshutdown /r /t 0'),
    block('html', { html: '<p>(<code>netdom</code> est disponible sur Windows Server ; sur un client, privilégie la méthode graphique.) Le redémarrage est <strong>obligatoire</strong> pour appliquer le nom.</p>' }),
    block('heading', { level: 2, text: '✅ Vérifier' }),
    cmd('hostname'),
    note('green', '🔗 Suite logique', '<p>Une fois renommé et redémarré, tu peux <strong>joindre le domaine</strong> : <code>sysdm.cpl</code> → « Modifier… » → <strong>Membre d’un domaine</strong>. Voir <a href="/procedure-installation-active-directory">Installer & configurer Active Directory</a>.</p>'),
  ],
};

// ===================================================================================
// 4) TEST DE CONNECTIVITÉ MÉTHODIQUE
// ===================================================================================
const testConnectivite: Page = {
  slug: 'procedure-test-connectivite',
  title: 'Test de connectivité méthodique',
  excerpt: 'Dépanner le réseau dans l’ordre (modèle OSI, du bas vers le haut) : loopback, IP locale, passerelle, hôte distant, Internet, DNS.',
  blocks: [
    block('hero', { eyebrow: 'Procédure · Diagnostic', title: 'Test de connectivité méthodique', subtitle: 'Tester dans l’ordre pour réduire le périmètre de la panne, du câble jusqu’au DNS.' }),
    stepsStyle,
    note('blue', '🧭 Le principe', '<p>On teste <strong>de proche en proche</strong> (couche basse → haute). Le <strong>premier test qui échoue</strong> localise la panne. Ne saute pas d’étape.</p>'),
    block('heading', { level: 2, text: '📋 La séquence à suivre' }),
    block('html', { html: `<ol class="proc-steps">
      <li><strong>Lien physique</strong> : câble branché, voyants de la carte allumés.</li>
      <li><strong>Config locale</strong> : <code>ipconfig /all</code> → IP correcte (pas de <code>169.254.x.x</code>), masque, passerelle et DNS présents.</li>
      <li><strong>Pile TCP/IP locale</strong> : <code>ping 127.0.0.1</code> (loopback). Échec = pile réseau HS.</li>
      <li><strong>Ta propre carte</strong> : <code>ping &lt;ton IP&gt;</code>.</li>
      <li><strong>Passerelle</strong> : <code>ping 192.168.10.254</code>. Échec = problème LAN / passerelle / VLAN.</li>
      <li><strong>Autre poste du réseau</strong> : <code>ping &lt;IP d’un voisin&gt;</code>. Échec ici mais passerelle OK = pare-feu du voisin (ICMP) ou mauvais sous-réseau.</li>
      <li><strong>Internet (IP)</strong> : <code>ping 8.8.8.8</code>. OK ici mais nom KO à l’étape suivante = souci <strong>DNS</strong>.</li>
      <li><strong>Résolution DNS</strong> : <code>nslookup google.com</code> puis <code>ping google.com</code>.</li>
      <li><strong>Chemin</strong> (si blocage distant) : <code>tracert 8.8.8.8</code> pour voir où ça coince.</li>
    </ol>` }),
    block('html', { html: `<div style="overflow-x:auto;margin:8px 0 14px"><table style="border-collapse:collapse;width:100%;min-width:560px;font-size:13.5px" class="ref-table"><thead><tr style="background:var(--surface-2)">${['Ça bloque à…', 'Cause probable'].map(h => `<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">${h}</th>`).join('')}</tr></thead><tbody>`
      + [
        ['ipconfig (169.254.x.x)', 'DHCP absent ou IP statique non appliquée'],
        ['ping 127.0.0.1', 'Pile TCP/IP corrompue'],
        ['ping passerelle', 'Câble, switch, VLAN, ou passerelle éteinte'],
        ['ping voisin (mais passerelle OK)', 'Pare-feu ICMP du voisin, ou mauvais masque/sous-réseau'],
        ['ping 8.8.8.8', 'Routage / NAT / accès Internet'],
        ['ping par nom (mais 8.8.8.8 OK)', 'Mauvais DNS configuré'],
      ].map(r => `<tr><td style="font-family:ui-monospace,'Space Mono',monospace">${r[0]}</td><td>${r[1]}</td></tr>`).join('')
      + `</tbody></table></div><style>.ref-table td{padding:7px 10px;border:1px solid var(--border)}</style>` }),
    note('green', '🔗 Outils liés', '<p><a href="/diagnostic-reseau">Diagnostic réseau interactif (modèle OSI)</a> · <a href="/astuce-pare-feu-ping">Autoriser le ping (ICMP) dans le pare-feu</a></p>'),
  ],
};

const PAGES: Page[] = [planAdressage, ipFixe, renommer, testConnectivite];

// ===================================================================================
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

  for (const p of PAGES) {
    const cur = existing.find(e => e.slug === p.slug);
    const bodyJson = JSON.stringify({ title: p.title, slug: p.slug, excerpt: p.excerpt, content: renderPageBlocksToHtml(p.blocks), builder_json: serializePageBlocks(p.blocks), published: 1 });
    const res = cur
      ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body: bodyJson })
      : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body: bodyJson });
    console.log(`PAGE ${p.slug}`, res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());
  }

  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

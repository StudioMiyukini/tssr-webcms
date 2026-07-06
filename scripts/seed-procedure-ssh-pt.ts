/* Procédure « Configurer le SSH sur Packet Tracer » : accès distant sécurisé à un routeur/switch
   Cisco (hostname, domaine, clés RSA, utilisateur local, lignes VTY, SSH v2) + test et dépannage.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-procedure-ssh-pt.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const SLUG = 'procedure-ssh-packet-tracer';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const stepsStyle = block('html', { html: `<style>.proc-steps{padding-left:22px;line-height:1.75}.proc-steps>li{margin:8px 0}.proc-steps code,.proc-steps kbd{font-family:ui-monospace,'Space Mono',monospace}.proc-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto}</style>` });
const cmd = (t: string) => block('html', { html: `<div class="proc-cmd">${t}</div>` });

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Procédure · Cisco / Packet Tracer', title: 'Configurer le SSH sur Packet Tracer', subtitle: 'Administrer un routeur ou un switch à distance, de façon chiffrée (remplace Telnet).' }),
  note('blue', '🎯 Pourquoi SSH', '<p><strong>SSH</strong> (port <strong>22</strong>) chiffre la session d’administration à distance, contrairement à <strong>Telnet</strong> (port 23, en clair). Sur un équipement Cisco, activer SSH demande : un <strong>nom d’hôte</strong>, un <strong>nom de domaine</strong>, des <strong>clés RSA</strong>, un <strong>compte local</strong> et l’activation sur les <strong>lignes VTY</strong>.</p>'),

  block('heading', { level: 2, text: '✅ Prérequis' }),
  block('html', { html: `<ul>
    <li>L’équipement a une <strong>adresse IP</strong> joignable (interface configurée, <code>no shutdown</code>) — voir le <a href="/configurateur-routeur-cisco">configurateur routeur</a>.</li>
    <li>Un poste (PC) ou un autre équipement pour tester la connexion.</li>
  </ul>` }),

  block('heading', { level: 2, text: '📋 Étapes (CLI)' }),
  block('html', { html: `<ol class="proc-steps">
    <li><strong>Nom d’hôte</strong> et <strong>nom de domaine</strong> (indispensables pour générer les clés) :</li>
  </ol>` }),
  cmd(`enable
configure terminal
hostname R1
ip domain-name miyukini.lan`),
  block('html', { html: `<ol class="proc-steps" start="2">
    <li><strong>Générer les clés RSA</strong> (choisir un module de <strong>1024</strong> bits ou plus) :</li>
  </ol>` }),
  cmd(`crypto key generate rsa
! Longueur de cle demandee -> saisir : 1024`),
  block('html', { html: `<ol class="proc-steps" start="3">
    <li><strong>Compte local</strong> (pour l’authentification SSH) + <strong>mot de passe enable</strong> :</li>
  </ol>` }),
  cmd(`username admin privilege 15 secret MonMotDePasse
enable secret MonSecretEnable`),
  block('html', { html: `<ol class="proc-steps" start="4">
    <li><strong>Activer SSH sur les lignes VTY</strong> (les lignes d’accès distant) et forcer l’authentification locale :</li>
  </ol>` }),
  cmd(`ip ssh version 2
line vty 0 4
 transport input ssh
 login local
 exit`),
  block('html', { html: `<ol class="proc-steps" start="5">
    <li><strong>Enregistrer</strong> la configuration :</li>
  </ol>` }),
  cmd(`end
write memory`),
  note('yellow', '⚠️ Points clés', '<ul><li>Sans <strong>hostname</strong> ni <strong>ip domain-name</strong>, la génération de clés <strong>échoue</strong>.</li><li><code>transport input ssh</code> = on <strong>interdit Telnet</strong> (mettre <code>ssh telnet</code> pour autoriser les deux — déconseillé).</li><li><code>login local</code> = authentification par le <strong>compte local</strong> (username/secret).</li></ul>'),

  block('heading', { level: 2, text: '🔀 Cas d’un switch (IP de gestion)' }),
  block('html', { html: '<p>Un <strong>switch</strong> est un équipement de <strong>niveau 2</strong> : ses ports n’ont pas d’adresse IP. Les commandes SSH ci-dessus sont <strong>identiques</strong>, mais il faut d’abord lui donner une <strong>IP de gestion</strong> sur une <strong>interface VLAN (SVI)</strong> et une <strong>passerelle par défaut</strong> (le switch ne route pas : sans passerelle, il ne peut pas répondre à un SSH venant d’un autre sous-réseau).</p>' }),
  cmd(`enable
configure terminal
! IP de gestion sur l'interface VLAN (VLAN 1 par defaut, ou un VLAN de gestion dedie)
interface vlan 1
 ip address 192.168.10.2 255.255.255.0
 no shutdown
 exit
! Passerelle par defaut du switch (indispensable pour l'acces distant hors sous-reseau)
ip default-gateway 192.168.10.254`),
  note('yellow', '💡 Switch vs routeur', '<ul><li>Le switch reçoit son IP sur une <strong>SVI</strong> (<code>interface vlan X</code>), pas sur un port physique.</li><li>Il utilise <code>ip default-gateway</code> (et non des routes), car il <strong>ne fait pas de routage</strong>.</li><li>Le reste (hostname, domaine, clés RSA, <code>username</code>, <code>line vty</code> / <code>transport input ssh</code> / <code>login local</code>) est <strong>identique</strong> au routeur.</li></ul>'),

  block('heading', { level: 2, text: '🔎 Vérifier & tester' }),
  block('html', { html: '<p>Sur l’équipement, contrôler l’état de SSH :</p>' }),
  cmd(`show ip ssh
show ssh`),
  block('html', { html: '<p>Depuis un <strong>PC</strong> (invite de commandes de Packet Tracer) ou un autre équipement, se connecter :</p>' }),
  cmd(`ssh -l admin 192.168.10.254`),
  block('html', { html: '<p>Saisir le mot de passe du compte <code>admin</code> → tu obtiens l’invite <code>R1&gt;</code> à distance.</p>' }),

  note('yellow', '🛠️ Si la connexion échoue', '<ul><li>« <em>No such command</em> » à <code>ssh</code> depuis un routeur → la commande est <code>ssh -l &lt;user&gt; &lt;ip&gt;</code>.</li><li>Connexion refusée → clés RSA non générées, ou <code>transport input</code> ne contient pas <code>ssh</code>, ou pas de compte local + <code>login local</code>.</li><li>IP injoignable → vérifier l’<strong>adressage</strong> et le <strong>ping</strong> vers l’équipement.</li></ul><p>Voir aussi : <a href="/procedure-test-connectivite">test de connectivité</a>.</p>'),

  note('green', '🎯 À retenir', '<p>SSH sur Cisco = <strong>hostname</strong> + <strong>ip domain-name</strong> + <strong>crypto key generate rsa</strong> + <strong>username … secret</strong> + <strong>line vty 0 4</strong> / <code>transport input ssh</code> / <code>login local</code> + <code>ip ssh version 2</code>. Test : <code>ssh -l admin &lt;IP&gt;</code>. SSH (22, chiffré) remplace Telnet (23, en clair).</p>'),
];

const PAGE = {
  slug: SLUG,
  title: 'Configurer le SSH sur Packet Tracer',
  excerpt: 'Procédure SSH Cisco (Packet Tracer) : hostname, ip domain-name, génération des clés RSA, compte local, enable secret, lignes VTY (transport input ssh / login local), SSH v2, test ssh -l et dépannage.',
};

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

  const cur = existing.find(e => e.slug === PAGE.slug);
  const bodyJson = JSON.stringify({ title: PAGE.title, slug: PAGE.slug, excerpt: PAGE.excerpt, content: renderPageBlocksToHtml(blocks), builder_json: serializePageBlocks(blocks), published: 1 });
  const res = cur
    ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body: bodyJson })
    : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body: bodyJson });
  console.log(`PAGE ${PAGE.slug}`, res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());

  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

/* Procédure « Configurer un routeur Cisco en CLI (Packet Tracer) » : modes Cisco, hostname,
   interfaces (IP, no shutdown, clock rate DCE), vérification et sauvegarde.
   Justifie manuellement l'outil « Configurateur — Routeur Cisco » et l'étape interfaces de l'Atelier.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-procedure-cisco-routeur-cli.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = { slug: 'procedure-cisco-routeur-cli', title: 'Configurer un routeur Cisco en CLI (Packet Tracer)', excerpt: 'Modes Cisco, nom d’hôte, configuration des interfaces (IP, no shutdown, clock rate DCE), vérification (show ip interface brief) et sauvegarde. Procédure manuelle du configurateur de routeur.' };
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stepsStyle = block('html', { html: `<style>.proc-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.55}</style>` });
const cmd = (t: string) => block('html', { html: `<div class="proc-cmd">${esc(t)}</div>` });

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Procédure · Cisco / Packet Tracer', title: PAGE.title, subtitle: 'Ce que fait le configurateur de routeur, étape par étape, à la main dans la CLI.' }),
  stepsStyle,
  note('blue', '🎯 Objectif', '<p>Configurer un routeur Cisco (2811 / 2911) en <strong>ligne de commande</strong> : lui donner un nom, activer et adresser ses <strong>interfaces</strong>, puis sauvegarder. C’est la démarche manuelle qui <strong>justifie</strong> l’outil <a href="/pages/configurateur-routeur-cisco">Configurateur — Routeur Cisco</a> et l’étape « interfaces » de l’<a href="/pages/atelier-reseau">Atelier Réseau</a>.</p>'),

  block('heading', { level: 2, text: '0) Repartir d’une configuration vierge (matériel réutilisé)' }),
  note('red', '🧨 Réflexe avant toute config', '<p>Un routeur ou un switch qui a déjà servi peut garder une config qui <strong>bloque tout</strong> : routes par défaut bidon, ACL/NAT hors sujet, doublons d’adresses, VLAN parasites. Avant de configurer, on <strong>efface la startup-config</strong> et on <strong>redémarre</strong> pour partir sur une base propre.</p>'),
  cmd(`enable
write erase          ! ou :  erase startup-config
reload
! "Save?  [yes/no]:"                 -> no   (ne PAS re-sauver l'ancienne config)
! "Proceed with reload? [confirm]"   -> Entree
! au redemarrage, refuser l'assistant :
! "...enter the initial configuration dialog? [yes/no]:"  -> no`),
  note('yellow', '💡 write erase efface la NVRAM', '<p><code>write erase</code> vide la <strong>startup-config</strong> (NVRAM) ; c’est le <code>reload</code> qui recharge alors une config vide. Sur un <strong>switch</strong>, supprime aussi la base VLAN si des VLAN parasites subsistent : <code>delete flash:vlan.dat</code> (confirmer) <strong>avant</strong> le <code>reload</code>.</p>'),

  block('heading', { level: 2, text: '🧭 Les modes Cisco' }),
  block('html', { html: '<p>La CLI Cisco a trois niveaux ; l’invite change selon le mode :</p>' }),
  block('html', { html: `<table style="border-collapse:collapse;width:100%;font-size:13px"><thead><tr style="background:var(--surface-2)">${['Mode', 'Invite', 'Pour…', 'Commande d’entrée'].map(c => `<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">${c}</th>`).join('')}</tr></thead><tbody>
${[['Utilisateur', 'R1&gt;', 'consulter (limité)', '(à la connexion)'], ['Privilégié', 'R1#', 'voir la config, sauvegarder', 'enable'], ['Configuration globale', 'R1(config)#', 'modifier la config', 'configure terminal'], ['Configuration d’interface', 'R1(config-if)#', 'régler une interface', 'interface &lt;nom&gt;']].map(r => `<tr>${r.map((c, i) => `<td style="padding:7px 10px;border:1px solid var(--border)${i === 1 ? ';font-family:ui-monospace,monospace' : ''}">${c}</td>`).join('')}</tr>`).join('')}
</tbody></table>` }),
  note('gray', '💡 Aides CLI', '<p><code>?</code> liste les commandes disponibles ; <kbd>Tab</kbd> complète ; <code>do &lt;commande&gt;</code> exécute une commande privilégiée depuis le mode config (ex. <code>do show ip interface brief</code>) ; <code>exit</code> remonte d’un niveau, <code>end</code> revient direct en mode privilégié.</p>'),

  block('heading', { level: 2, text: '1) Passer en configuration et nommer le routeur' }),
  cmd(`enable
configure terminal
hostname R1`),
  block('html', { html: '<p>L’invite passe de <code>Router&gt;</code> à <code>R1(config)#</code>. Le <strong>nom d’hôte</strong> facilite le repérage (surtout avec plusieurs routeurs).</p>' }),

  block('heading', { level: 2, text: '2) Configurer une interface LAN (Ethernet)' }),
  block('html', { html: '<p>Pour chaque réseau connecté au routeur, on adresse l’interface correspondante avec l’<strong>IP de la passerelle</strong> de ce sous-réseau, puis on l’<strong>active</strong> (les interfaces sont éteintes par défaut, d’où <code>no shutdown</code>).</p>' }),
  cmd(`interface GigabitEthernet0/0
 description LAN Production
 ip address 192.168.10.126 255.255.255.128
 no shutdown
 exit`),
  note('yellow', '⚠️ FastEthernet vs GigabitEthernet', '<p>Sur un <strong>2811</strong> les interfaces sont des <code>FastEthernet0/0</code>, <code>FastEthernet0/1</code> ; sur un <strong>2911</strong> des <code>GigabitEthernet0/0</code> à <code>0/2</code>. Adapte le nom au modèle. Le passage à <code>R1(config-if)#</code> confirme que tu es bien sur l’interface.</p>'),

  block('heading', { level: 2, text: '3) Configurer une liaison série (entre routeurs)' }),
  block('html', { html: '<p>Sur une liaison <strong>série</strong>, un seul côté fournit l’horloge : le côté <strong>DCE</strong> (repérable par <code>show controllers serial 0/0/0</code>). Il faut y ajouter <code>clock rate</code>. Le côté <strong>DTE</strong> ne prend que l’adresse.</p>' }),
  cmd(`interface Serial0/0/0
 description Lien vers R2 (DCE)
 ip address 10.0.0.1 255.255.255.252
 clock rate 64000
 no shutdown
 exit`),

  block('heading', { level: 2, text: '4) Vérifier' }),
  cmd(`do show ip interface brief`),
  block('html', { html: '<p>Chaque interface configurée doit afficher son IP et l’état <strong>up / up</strong>. Si c’est <em>administratively down</em>, il manque le <code>no shutdown</code> ; si c’est <em>down/down</em> sur une série, vérifie le câble et le <code>clock rate</code> côté DCE.</p>' }),
  cmd(`do show running-config`),

  block('heading', { level: 2, text: '5) Sauvegarder' }),
  block('html', { html: '<p>La config vit en mémoire volatile (<em>running-config</em>). Sans sauvegarde, elle est perdue au redémarrage. On la copie dans la <em>startup-config</em> :</p>' }),
  cmd(`end
write memory`),
  block('html', { html: '<p>(<code>write memory</code> = <code>copy running-config startup-config</code>.)</p>' }),

  note('green', '✅ Justification', '<p>Tu viens de faire à la main ce que génère l’outil : <strong>hostname</strong>, <strong>interfaces</strong> (IP + <code>no shutdown</code>, <code>clock rate</code> côté DCE) et <strong>sauvegarde</strong>. Pour la suite : les <a href="/pages/procedure-routes-statiques">routes statiques</a>, puis <a href="/pages/procedure-ssh-packet-tracer">SSH</a>. Cours associé : <a href="/pages/cisco-routeur-cli">Configurer un routeur en CLI</a>.</p>'),
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

/* Page « Simulateur complet — Poste de travail virtuel » : bureau réunissant les
   outils existants (îlot data-block="virtual-lab") — Windows/Hyper-V/AD/DNS-DHCP-IIS/GPO,
   invite de commandes cmd & PowerShell, console routeur Cisco, Réalisation 1.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-simulateur-complet.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Outil · Simulateur complet', title: 'Poste de travail virtuel', subtitle: 'Un seul bureau qui réunit tous les simulateurs : Windows Server (Hyper-V, Active Directory, DNS/DHCP/IIS, GPO), l’invite de commandes (cmd & PowerShell), la console routeur Cisco et la Réalisation 1.' }),
  block('html', { html: '<p>Ce <strong>poste de travail virtuel</strong> rassemble les outils de la plateforme dans un même environnement, avec <strong>barre des tâches</strong>, <strong>menu Démarrer</strong> et <strong>plein écran</strong>. Chaque application s’ouvre dans sa fenêtre et <strong>conserve son état</strong> quand tu passes de l’une à l’autre — comme sur une vraie machine.</p>' }),
  block('list', { listItems: [
    '🪟 <strong>Windows Server</strong> — parcours des interfaces graphiques : paramètres réseau, Hyper-V, rôles (DNS, DHCP, IIS), promotion Active Directory, ADUC (OU + utilisateurs) et GPO.',
    '⌨️ <strong>Invite de commandes</strong> — bac à sable cmd &amp; PowerShell : ipconfig, ping, nslookup, netsh, net, rename-computer, New-NetIPAddress… avec un état machine (cartes, hôtes, DNS, pare-feu) qui réagit.',
    '🧭 <strong>Console routeur Cisco</strong> — génère la configuration IOS : interfaces, routes statiques, NAT/PAT, redirection de port, SSH — prête à coller dans Packet Tracer.',
    '🧪 <strong>Réalisation 1</strong> — création des VM (RAM, disques), commutateurs Hyper-V et fenêtres Windows, façon examen « Réalisation ».',
  ] }),
  note('blue', 'ℹ️ Comment l’utiliser', '<p>Clique une <strong>icône du bureau</strong> ou le bouton <strong>Démarrer</strong> pour lancer un outil. Utilise la <strong>barre des tâches</strong> pour basculer entre les fenêtres ouvertes, le bouton <strong>⛶ plein écran</strong> pour travailler comme sur un poste dédié. Astuce examen : enchaîne <em>console routeur</em> → <em>invite de commandes</em> (tests ping/nslookup) → <em>Windows Server</em> (AD/DNS/DHCP) pour dérouler un TP de bout en bout.</p>'),
  block('html', { html: '<div class="pb-dynamic" data-block="virtual-lab"></div>' }),
  note('green', '🎓 Se justifier sans l’outil', '<p>Ces simulateurs servent à <strong>t’entraîner au geste</strong> (parcours graphiques, commandes, config CLI). Le jour de l’examen tu dois savoir <strong>refaire à la main</strong> : révise les procédures détaillées — <a href="/pages/procedure-atelier-reseau-az">réseau multi-routeurs de A à Z</a>, <a href="/pages/procedure-ad">Active Directory</a>, <a href="/pages/cmd-powershell">cmd &amp; PowerShell</a> — et l’<a href="/pages/atelier-reseau">Atelier Réseau</a> pour le plan d’adressage.</p>'),
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
  const cur = existing.find(e => e.slug === 'simulateur-complet');
  const body = JSON.stringify({ title: 'Simulateur complet — Poste de travail virtuel', slug: 'simulateur-complet', excerpt: 'Un bureau virtuel réunissant tous les simulateurs : Windows Server (Hyper-V, Active Directory, DNS/DHCP/IIS, GPO), invite de commandes cmd & PowerShell, console routeur Cisco et Réalisation 1 — barre des tâches, menu Démarrer et plein écran.', content: renderPageBlocksToHtml(blocks), builder_json: serializePageBlocks(blocks), published: 1 });
  const res = cur
    ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body })
    : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
  console.log('PAGE simulateur-complet', res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());
  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

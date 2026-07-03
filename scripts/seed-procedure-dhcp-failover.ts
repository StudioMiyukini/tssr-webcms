/* Procédure « Configurer le basculement DHCP (failover) » : redondance DHCP entre 2 serveurs.
   Prérequis (domaine AD, autorisation, horloge, port 647), modes répartition/veille, pas-à-pas,
   paramètres (MCLT, secret partagé), vérification et dépannage.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-procedure-dhcp-failover.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const SLUG = 'procedure-dhcp-basculement';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const stepsStyle = block('html', { html: `<style>.proc-steps{padding-left:22px;line-height:1.75}.proc-steps>li{margin:7px 0}.proc-steps code,.proc-steps kbd{font-family:ui-monospace,'Space Mono',monospace}.proc-steps kbd{border:1px solid var(--border);border-radius:5px;padding:1px 6px;background:var(--surface-2)}.ref-table td{padding:8px 10px;border:1px solid var(--border)}.chk{list-style:none;padding-left:0}.chk>li{margin:6px 0;padding-left:26px;position:relative}.chk>li::before{content:"☐";position:absolute;left:0;font-size:16px}</style>` });

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Procédure · Hébergement', title: 'Configurer le basculement DHCP (failover)', subtitle: 'Rendre le service DHCP redondant entre deux serveurs, pour qu’une panne ne coupe pas la distribution d’adresses.' }),
  stepsStyle,
  note('blue', '🎯 Le principe', '<p>Le <strong>basculement DHCP</strong> (<em>failover</em>) fait <strong>coopérer deux serveurs DHCP</strong> qui partagent la même étendue. Si l’un tombe, l’autre continue à distribuer et renouveler les baux : plus de coupure. La configuration se fait <strong>une seule fois</strong>, depuis le serveur qui porte déjà l’étendue ; elle se réplique sur le partenaire.</p>'),

  block('heading', { level: 2, text: '✅ Prérequis (à vérifier AVANT — c’est ici que ça coince)' }),
  block('html', { html: `<ul class="chk">
    <li>Les <strong>deux serveurs</strong> ont le <strong>rôle DHCP installé</strong>.</li>
    <li>Les deux serveurs sont <strong>membres du MÊME domaine Active Directory</strong> et <strong>autorisés</strong> dans l’AD (console DHCP → clic droit serveur → <em>Autoriser</em>). <strong>Sans appartenance au domaine, la validation du serveur partenaire échoue.</strong></li>
    <li>Les <strong>horloges</strong> des deux serveurs sont <strong>synchronisées</strong> (écart &lt; 1 minute) — sinon l’assistant avertit ou refuse.</li>
    <li><strong>Connectivité réseau</strong> entre les deux serveurs, <strong>port TCP 647</strong> ouvert (trafic du failover).</li>
    <li>Il existe déjà <strong>au moins une étendue active</strong> sur le serveur primaire (celle qu’on va répliquer).</li>
  </ul>` }),

  block('heading', { level: 2, text: '🔀 Choisir le mode' }),
  block('html', { html: `<div style="overflow-x:auto;margin:6px 0 12px"><table style="border-collapse:collapse;width:100%;min-width:600px;font-size:13.5px" class="ref-table"><thead><tr style="background:var(--surface-2)">${['Mode', 'Fonctionnement', 'Quand l’utiliser'].map(h => `<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">${h}</th>`).join('')}</tr></thead><tbody>`
    + [
      ['<strong>Répartition de charge</strong><br><span class="meta">(Load balance)</span>', 'Les <strong>deux serveurs sont actifs</strong> et se partagent les baux selon un ratio (défaut <strong>50/50</strong>).', 'Deux serveurs sur le <strong>même site</strong> : performance + redondance.'],
      ['<strong>Veille active</strong><br><span class="meta">(Hot standby)</span>', 'Un serveur <strong>actif</strong>, un serveur <strong>de secours</strong> qui prend le relais en cas de panne. Le secours réserve un % d’adresses (défaut <strong>5%</strong>).', 'Un serveur <strong>central</strong> + un serveur de <strong>secours</strong> (autre site).'],
    ].map(r => `<tr><td style="padding:8px 10px;border:1px solid var(--border)">${r[0]}</td><td style="padding:8px 10px;border:1px solid var(--border)">${r[1]}</td><td style="padding:8px 10px;border:1px solid var(--border)">${r[2]}</td></tr>`).join('')
    + `</tbody></table></div>` }),

  block('heading', { level: 2, text: '📋 Configuration pas-à-pas' }),
  block('html', { html: `<ol class="proc-steps">
    <li>Sur le <strong>serveur primaire</strong> (celui qui porte l’étendue), ouvre la console <strong>DHCP</strong> (<code>dhcpmgmt.msc</code>).</li>
    <li>Déplie <strong>IPv4</strong> → <strong>clic droit sur l’étendue</strong> (ou sur <em>IPv4</em>) → <strong>« Configurer un basculement… »</strong>.</li>
    <li>Sélectionne la ou les <strong>étendues à répliquer</strong> → <em>Suivant</em>.</li>
    <li><strong>Serveur partenaire</strong> : saisis le <strong>nom d’hôte ou l’IP</strong> du second serveur (ou <em>Ajouter un serveur</em>) → <em>Suivant</em>.
      <br><span class="meta">Croix rouge « Erreur de validation du serveur partenaire » ? → voir Dépannage plus bas.</span></li>
    <li>Renseigne les <strong>paramètres de la relation</strong> :
      <ul>
        <li><strong>Nom de la relation</strong> (libre).</li>
        <li><strong>Mode</strong> : <em>Répartition de charge</em> ou <em>Veille active</em> (+ ratio ou % de secours).</li>
        <li><strong>MCLT</strong> (<em>Maximum Client Lead Time</em>) : durée pendant laquelle un serveur peut prolonger seul un bail si le partenaire est injoignable (défaut <strong>1 h</strong>).</li>
        <li><strong>Intervalle de basculement d’état</strong> (optionnel) : délai avant de passer automatiquement le partenaire en « injoignable ».</li>
        <li>Coche <strong>« Activer l’authentification des messages »</strong> et saisis un <strong>secret partagé</strong> (mot de passe commun aux deux serveurs).</li>
      </ul>
    </li>
    <li><em>Suivant</em> → récapitulatif → <strong>Terminer</strong>. L’étendue apparaît alors <strong>sur les deux serveurs</strong>.</li>
  </ol>` }),

  block('heading', { level: 2, text: '🔎 Vérifier que ça marche' }),
  block('html', { html: `<ol class="proc-steps">
    <li>Sur <strong>chaque serveur</strong>, l’étendue est visible et le <strong>basculement</strong> est à l’état <strong>« Normal »</strong> (clic droit étendue → <em>Basculement</em>).</li>
    <li><strong>Test réel</strong> : sur le primaire, arrête le service (<code>services.msc</code> → <em>Serveur DHCP</em> → Arrêter).</li>
    <li>Sur un <strong>client</strong>, force le renouvellement : <code>ipconfig /renew</code> → il doit <strong>toujours obtenir un bail</strong> (servi par le partenaire).</li>
    <li>Redémarre le service DHCP du primaire.</li>
  </ol>` }),

  note('purple', '🛠️ Dépannage — « Erreur de validation du serveur partenaire »', '<p>Cause la plus fréquente : le serveur DHCP <strong>n’est pas membre du domaine AD cible</strong>. Vérifie dans l’ordre : <strong>appartenance au domaine</strong> des deux serveurs, <strong>autorisation DHCP dans l’AD</strong>, <strong>port TCP 647</strong> ouvert, <strong>horloges synchronisées</strong>. Détail : <a href="/depannage#dep-dhcp-basculement-partenaire">Dépannage → DHCP</a>.</p>'),
  note('green', '🔗 Voir aussi', '<p><a href="/procedure-dhcp">DHCP : étendue, options & réservation</a> (créer l’étendue d’abord) · <a href="/procedure-renommer-poste">Renommer un poste</a> · <a href="/procedure-installation-active-directory">Installer Active Directory</a>.</p>'),
];

const PAGE = {
  slug: SLUG,
  title: 'Configurer le basculement DHCP (failover)',
  excerpt: 'Procédure pas-à-pas pour rendre le DHCP redondant entre deux serveurs : prérequis (domaine AD, autorisation, port 647, horloge), modes répartition de charge / veille active, paramètres (MCLT, secret partagé), vérification et dépannage.',
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

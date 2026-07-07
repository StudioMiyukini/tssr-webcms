/* Procédure « Configurer les routes statiques (multi-routeurs) sur Packet Tracer » :
   identifier les réseaux non connectés, trouver le prochain saut (plus court chemin), écrire ip route,
   route par défaut, vérifier. Justifie manuellement le générateur de routes statiques.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-procedure-routes-statiques.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = { slug: 'procedure-routes-statiques', title: 'Configurer les routes statiques (multi-routeurs)', excerpt: 'Sur une topologie à plusieurs routeurs : repérer les réseaux non directement connectés, déterminer le prochain saut (plus court chemin), écrire les ip route, ajouter une route par défaut et vérifier. Procédure manuelle du générateur de routes.' };
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stepsStyle = block('html', { html: `<style>.proc-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.55}</style>` });
const cmd = (t: string) => block('html', { html: `<div class="proc-cmd">${esc(t)}</div>` });

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Procédure · Cisco / Packet Tracer', title: PAGE.title, subtitle: 'Faire communiquer plusieurs routeurs à la main : la méthode que le générateur automatise.' }),
  stepsStyle,
  note('blue', '🎯 Le problème', '<p>Un routeur ne connaît <strong>que les réseaux directement branchés sur ses interfaces</strong> (marqués <code>C</code> dans sa table). Pour joindre un réseau <strong>distant</strong> (derrière un autre routeur), il faut lui indiquer <strong>par où passer</strong> : c’est une <strong>route statique</strong>. Cette procédure <strong>justifie</strong> l’outil <a href="/pages/generateur-routes-statiques">Générateur — Routes statiques</a>.</p>'),
  note('gray', '🧩 Syntaxe', '<p><code>ip route &lt;réseau_destination&gt; &lt;masque&gt; &lt;prochain_saut&gt;</code><br>« Pour atteindre CE réseau (avec CE masque), envoie les paquets à CETTE adresse (le routeur voisin sur le chemin). »</p>'),

  block('heading', { level: 2, text: '1) Lister tous les réseaux de la topologie' }),
  block('html', { html: '<p>Fais l’inventaire de <strong>tous</strong> les sous-réseaux : chaque LAN et chaque liaison entre routeurs, avec leur adresse réseau et leur masque (voir <a href="/pages/procedure-plan-adressage">le plan d’adressage</a>). Exemple à 3 routeurs :</p>' }),
  block('list', { listItems: [
    'LAN A — 192.168.10.0/25 (derrière R1)',
    'LAN B — 192.168.20.0/26 (derrière R3)',
    'Liaison R1–R2 — 10.0.0.0/30',
    'Liaison R2–R3 — 10.0.0.4/30',
  ] }),

  block('heading', { level: 2, text: '2) Sur chaque routeur, repérer ce qui est déjà connu' }),
  cmd(`R2# show ip route`),
  block('html', { html: '<p>Les lignes <code>C</code> (Connected) et <code>L</code> (Local) = réseaux <strong>directement connectés</strong> : aucune route à écrire pour eux. Tout le reste devra être ajouté en <strong>statique</strong>.</p>' }),

  block('heading', { level: 2, text: '3) Déterminer le prochain saut (plus court chemin)' }),
  block('html', { html: '<p>Pour un réseau distant, le <strong>prochain saut</strong> = l’adresse IP du <strong>routeur voisin</strong> situé sur le chemin le plus court vers ce réseau (l’interface du voisin qui est sur la liaison partagée). Depuis <strong>R1</strong>, pour joindre le LAN B (derrière R3), on passe d’abord par <strong>R2</strong> → prochain saut = l’IP de R2 sur la liaison R1–R2 (<code>10.0.0.2</code>).</p>' }),
  note('yellow', '⚠️ Le prochain saut est toujours un VOISIN direct', '<p>Jamais l’IP finale ni un routeur lointain : c’est l’adresse du routeur <strong>immédiatement suivant</strong>, joignable directement. R1 ne « voit » que R2 ; c’est R2 qui saura ensuite atteindre R3.</p>'),

  block('heading', { level: 2, text: '4) Écrire les routes' }),
  block('html', { html: '<p><strong>Sur R1</strong> (doit atteindre : LAN B, liaison R2–R3) :</p>' }),
  cmd(`configure terminal
ip route 192.168.20.0 255.255.255.192 10.0.0.2
ip route 10.0.0.4 255.255.255.252 10.0.0.2
end`),
  block('html', { html: '<p><strong>Sur R3</strong> (doit atteindre : LAN A, liaison R1–R2) — prochain saut = R2 côté R2–R3 (<code>10.0.0.5</code>) :</p>' }),
  cmd(`configure terminal
ip route 192.168.10.0 255.255.255.128 10.0.0.5
ip route 10.0.0.0 255.255.255.252 10.0.0.5
end`),
  block('html', { html: '<p><strong>Sur R2</strong> (au centre) : il est connecté aux deux liaisons, il ne lui manque que les 2 LAN. LAN A via R1 (<code>10.0.0.1</code>), LAN B via R3 (<code>10.0.0.6</code>) :</p>' }),
  cmd(`configure terminal
ip route 192.168.10.0 255.255.255.128 10.0.0.1
ip route 192.168.20.0 255.255.255.192 10.0.0.6
end`),
  note('gray', '🔁 Règle d’or : la route retour', '<p>Une communication doit fonctionner <strong>dans les deux sens</strong>. Si A ping B, B doit savoir revenir vers A. Vérifie que <strong>chaque</strong> routeur a une route (aller ET retour) vers <strong>chaque</strong> réseau non connecté.</p>'),

  block('heading', { level: 2, text: '5) Route par défaut (optionnel — sortie Internet)' }),
  block('html', { html: '<p>Si un routeur a une seule sortie « vers tout le reste » (ex. Internet), une route par défaut évite de tout énumérer :</p>' }),
  cmd(`ip route 0.0.0.0 0.0.0.0 <IP_du_routeur_de_sortie>`),

  block('heading', { level: 2, text: '6) Vérifier' }),
  cmd(`show ip route`),
  block('html', { html: '<p>Les routes ajoutées apparaissent avec le code <code>S</code> (Static). Test de bout en bout depuis un PC du LAN A :</p>' }),
  cmd(`ping 192.168.20.10`),
  block('html', { html: '<p>Si ça échoue : vérifie la <strong>route retour</strong> sur le routeur distant, le <strong>masque</strong> de la destination, et que les interfaces sont <strong>up/up</strong> (<code>show ip interface brief</code>).</p>' }),

  note('green', '✅ Justification', '<p>Tu as déterminé, routeur par routeur, les réseaux non connectés et le bon prochain saut, puis écrit les <code>ip route</code> — exactement le calcul que fait l’outil. Prérequis : <a href="/pages/procedure-cisco-routeur-cli">interfaces configurées</a>. Cours : <a href="/pages/cisco-route-statique">Les routes statiques en CLI</a>.</p>'),
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

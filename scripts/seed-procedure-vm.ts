/* Procédure « Créer & configurer une VM (ISO) sur Hyper-V » — catégorie Procédures.
   Ordre : création VM Hyper-V → installation OS (résumé) → renommer le PC → redémarrage reporté →
   ncpa.cpl → IP fixe (IP/MSR/passerelle/DNS) → exceptions pare-feu → redémarrage → début du TP.
   Emplacements réservés pour de futures captures (cadres pointillés).
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-procedure-vm.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
import { buildHubBlocks } from './_hub';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
// Emplacement réservé pour une future capture d'écran.
const shot = (cap: string) => block('html', { html: `<figure style="margin:10px 0 14px"><div style="border:2px dashed var(--border);border-radius:10px;background:var(--surface-2);padding:26px 16px;text-align:center;color:var(--text-muted)"><div style="font-size:24px">📷</div><div style="font-size:12.5px;margin-top:2px;font-weight:600">Capture à insérer</div></div><figcaption class="meta" style="margin-top:6px;font-size:12.5px">${cap}</figcaption></figure>` });
// Image réelle (capture insérée).
const fig = (url: string, cap: string) => block('html', { html: `<figure style="margin:10px 0 14px;text-align:center"><img src="${url}" alt="${cap}" loading="lazy" style="max-width:100%;border:1px solid var(--border);border-radius:8px"/><figcaption class="meta" style="margin-top:6px;font-size:12.5px">${cap}</figcaption></figure>` });

// ===================================================================================
// Schéma SVG : la chaîne des étapes (texte ASCII)
// ===================================================================================
const C = { net: '#2563eb', dev: '#059669', warn: '#d97706', danger: '#dc2626', grey: '#64748b', slate: '#475569', purple: '#7c3aed', ok: '#16a34a' };
const wrap = (w: number, h: number, inner: string) => `<svg viewBox="0 0 ${w} ${h}" role="img" style="max-width:${w}px;width:100%;height:auto;margin:8px 0 14px;font-family:system-ui,sans-serif">${inner}</svg>`;
const svgFlow = wrap(640, 150, (() => {
  const steps: Array<[string, string]> = [
    ['1', 'Creer la VM'], ['2', 'Installer OS'], ['3', 'Renommer'], ['4', 'ncpa.cpl'],
    ['5', 'IP fixe'], ['6', 'Pare-feu'], ['7', 'Redemarrer'], ['8', 'TP'],
  ];
  const W = 68, gap = 9, y = 42, h = 46; let x = 8, s = '';
  s += `<text x="320" y="22" text-anchor="middle" font-size="12" fill="${C.slate}" font-weight="bold">L ordre a respecter</text>`;
  steps.forEach(([nplus, t], i) => {
    const col = i === 6 ? C.danger : i === 7 ? C.ok : C.net;
    s += `<rect x="${x}" y="${y}" width="${W}" height="${h}" rx="7" fill="${col}" fill-opacity="0.12" stroke="${col}" stroke-width="1.6"/>`;
    s += `<text x="${x + W / 2}" y="${y + 20}" text-anchor="middle" font-size="13" fill="${col}" font-weight="bold">${nplus}</text>`;
    s += `<text x="${x + W / 2}" y="${y + 36}" text-anchor="middle" font-size="9" fill="${C.slate}">${t}</text>`;
    if (i < steps.length - 1) { const ax = x + W; s += `<path d="M${ax + 1} ${y + h / 2} l${gap - 3} 0 m-4 -3 l4 3 l-4 3" stroke="${C.grey}" stroke-width="1.6" fill="none"/>`; }
    x += W + gap;
  });
  s += `<text x="320" y="120" text-anchor="middle" font-size="10.5" fill="${C.grey}">Le renommage exige un redemarrage : on le REPORTE et on ne redemarre qu UNE fois (etape 7),</text>`;
  s += `<text x="320" y="136" text-anchor="middle" font-size="10.5" fill="${C.grey}">apres avoir configure le reseau et le pare-feu.</text>`;
  return s;
})());

// ===================================================================================
// PAGE
// ===================================================================================
const SLUG = 'procedure-vm-hyperv';
const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Procédure · Hyper-V', title: 'Créer & configurer une VM (ISO) sur Hyper-V', subtitle: 'Mode opératoire complet : de la création de la machine virtuelle jusqu’au début du TP.' }),
  block('html', { html: '<p>Cette <strong>procédure</strong> décrit, dans l’ordre, comment <strong>créer une machine virtuelle</strong> sur Hyper-V à partir d’un <strong>ISO</strong>, puis la <strong>préparer</strong> (nom, adresse IP fixe, pare-feu) avant de démarrer un TP. Suis les étapes <strong>dans l’ordre</strong> : il est pensé pour ne <strong>redémarrer qu’une seule fois</strong>.</p>' }),
  note('blue', '🧰 Prérequis', '<p>Avoir : le <strong>fichier ISO</strong> de l’OS, le rôle/fonctionnalité <strong>Hyper-V</strong> activé sur l’hôte, un <strong>commutateur virtuel</strong> créé (privé/interne pour un labo isolé — voir <a href="/pages/virtualisation">la virtualisation Hyper-V</a>), et un <strong>plan d’adressage</strong> (IP, masque, passerelle, DNS).</p>'),
  block('html', { html: svgFlow }),

  block('heading', { level: 2, text: '1️⃣ Créer la VM sur Hyper-V' }),
  block('html', { html: '<p>Ouvre le <strong>Gestionnaire Hyper-V</strong>, puis <em>Action → Nouveau → Ordinateur virtuel</em>. Déroule l’assistant :</p>' }),
  block('list', { listItems: [
    'Nom : un nom clair (ex. SRV-DNS) et, si besoin, l’emplacement de stockage.',
    'Génération : Génération 2 (UEFI) recommandée pour un OS récent ; Génération 1 pour un vieil OS.',
    'Mémoire de démarrage : ex. 4096 Mo (mémoire dynamique selon le besoin).',
    'Mise en réseau : choisir le commutateur virtuel (privé/interne pour un labo isolé).',
    'Disque dur virtuel : créer un disque (ex. 40 Go) — taille dynamique par défaut.',
    'Options d’installation : « Installer un système d’exploitation à partir d’un fichier image de démarrage (.iso) » → sélectionner ton ISO.',
    'Terminer.',
  ] }),
  note('yellow', '⚙️ Génération 2', '<p>En Génération 2, si tu installes un OS non signé Microsoft (certaines distributions Linux), pense à <strong>désactiver le Démarrage sécurisé</strong> (Paramètres de la VM → Sécurité). Pour Windows Server, laisse activé.</p>'),
  shot('Assistant « Nouvel ordinateur virtuel » — étape « Options d’installation » avec l’ISO sélectionné.'),
  block('html', { html: '<p>Sélectionne la VM → <strong>Connecter</strong> → <strong>Démarrer</strong> : elle amorce sur l’ISO.</p>' }),

  block('heading', { level: 2, text: '2️⃣ Installer l’OS (résumé)' }),
  block('html', { html: '<p>Au démarrage sur l’ISO : choisir la <strong>langue/clavier</strong> → <strong>Installer maintenant</strong> → édition <strong>« avec Expérience de bureau »</strong> (pour avoir l’interface graphique) → accepter la licence → installation <strong>personnalisée</strong> → choisir le disque → laisser installer → définir le <strong>mot de passe administrateur</strong> → ouvrir la session.</p>' }),
  note('blue', '📖 Détaillé ailleurs', '<p>L’installation de l’OS pas-à-pas (partitionnement, éditions, options) fera l’objet d’une <strong>page de cours dédiée</strong>. Ici, on se concentre sur la <strong>configuration</strong> qui suit l’installation.</p>'),
  shot('Écran d’installation de Windows (« Installer maintenant » / choix de l’édition).'),

  block('heading', { level: 2, text: '3️⃣ Renommer le PC' }),
  block('html', { html: '<p>Donne à la machine un <strong>nom clair et identifiable</strong> sur le réseau (ex. <code>SRV-DNS</code>, <code>CLIENT-W11-01</code>).</p>' }),
  block('list', { listItems: [
    'Win+R → sysdm.cpl → onglet « Nom de l’ordinateur » → Modifier… (ou Paramètres → Système → Informations système → Renommer ce PC).',
    'Saisir le nouveau nom → OK.',
  ] }),
  fig('/uploads/mr0f64p8-2y7s6d-vm-renommer-systeme.png', 'Clic droit sur le menu Démarrer → Système → page « Informations système » (ici la VM se nomme SRV-AD).'),
  fig('/uploads/mr0f65v8-xdjlvz-vm-renommer-proprietes-systeme.png', 'Propriétés système → onglet « Nom de l’ordinateur » → « Modifier… » → saisie du nom (et, plus tard, jonction au domaine).'),

  block('heading', { level: 2, text: '4️⃣ Reporter le redémarrage' }),
  block('html', { html: '<p>Windows propose de <strong>redémarrer</strong> pour appliquer le nouveau nom : choisis <strong>« Redémarrer plus tard »</strong>. On va d’abord configurer le réseau et le pare-feu, puis faire <strong>un seul redémarrage</strong> à la fin (étape 7).</p>' }),
  note('green', '💡 Pourquoi reporter ?', '<p>Renommer, configurer l’IP et ouvrir le pare-feu n’imposent pas chacun un redémarrage immédiat. En <strong>reportant</strong>, on évite d’en enchaîner plusieurs : <strong>un seul</strong> suffit, une fois tout préparé.</p>'),

  block('heading', { level: 2, text: '5️⃣ Ouvrir les connexions réseau (ncpa.cpl)' }),
  block('html', { html: '<p>Accède directement aux cartes réseau : <strong>Win+R → <code>ncpa.cpl</code> → Entrée</strong>. Clic droit sur la carte <strong>Ethernet</strong> → <strong>Propriétés</strong>.</p>' }),
  fig('/uploads/mr0f66a1-xlkxi-vm-ncpa-proprietes-ipv4.png', 'ncpa.cpl → clic droit sur la carte Ethernet → Propriétés → sélectionner « Protocole Internet version 4 (TCP/IPv4) ».'),

  block('heading', { level: 2, text: '6️⃣ Configurer l’adresse IP fixe' }),
  block('html', { html: '<p>Dans les propriétés de la carte, sélectionne <strong>« Protocole Internet version 4 (TCP/IPv4) »</strong> → <strong>Propriétés</strong>, puis coche <strong>« Utiliser l’adresse IP suivante »</strong> et renseigne :</p>' }),
  block('html', { html: `<div style="overflow-x:auto;margin:6px 0 12px"><table style="border-collapse:collapse;width:100%;min-width:560px;font-size:13.5px"><thead><tr style="background:var(--surface-2)">${['Champ', 'Exemple', 'Rôle'].map(c => `<th style="text-align:left;padding:8px 10px;border:1px solid var(--border)">${c}</th>`).join('')}</tr></thead><tbody>` +
    [
      ['Adresse IP', '192.168.10.11', 'L’identité de la machine sur le réseau'],
      ['Masque de sous-réseau (MSR)', '255.255.255.0', 'Délimite le réseau (ici /24)'],
      ['Passerelle par défaut', '192.168.10.254', 'La sortie vers les autres réseaux'],
      ['Serveur DNS préféré', '192.168.10.11', 'La résolution des noms (souvent le serveur DNS/AD)'],
    ].map(r => `<tr><td style="padding:8px 10px;border:1px solid var(--border);font-weight:600">${r[0]}</td><td style="padding:8px 10px;border:1px solid var(--border);font-family:ui-monospace,monospace">${r[1]}</td><td style="padding:8px 10px;border:1px solid var(--border)">${r[2]}</td></tr>`).join('') +
    `</tbody></table></div>` }),
  note('yellow', '🚪 La passerelle, même « inutile »', '<p>En labo isolé (sans accès Internet), la passerelle ne sert à rien dans l’immédiat — <strong>renseigne-la quand même</strong> : ça garde une configuration cohérente, évite des avertissements, et permet de sortir du réseau le jour où c’est nécessaire. <strong>MSR</strong> = Masque de Sous-Réseau.</p>'),
  block('html', { html: '<p>Valide par <strong>OK</strong> puis <strong>Fermer</strong>. Vérifie avec <code>ipconfig</code> (invite de commandes) que l’IP est bien prise en compte.</p>' }),
  fig('/uploads/mr0f66ba-m44dba-vm-ip-fixe-ipv4.png', 'Propriétés TCP/IPv4 : IP 192.168.10.11, masque 255.255.255.0, passerelle 192.168.10.254, DNS préféré 127.0.0.1 (le serveur se pointe lui-même).'),

  block('heading', { level: 2, text: '7️⃣ Ouvrir les exceptions du pare-feu' }),
  block('html', { html: '<p>Autorise les flux dont le TP a besoin — au minimum le <strong>ping (ICMP)</strong> pour vérifier la communication, plus les services à venir (DNS, etc.).</p>' }),
  block('list', { listItems: [
    'Win+R → wf.msc → Règles de trafic entrant.',
    'Activer « Partage de fichiers et d’imprimantes (Demande d’écho - Trafic entrant ICMPv4) » (et ICMPv6 si besoin).',
    'Ouvrir les autres exceptions nécessaires au TP (selon le rôle installé).',
  ] }),
  note('blue', '🔗 Détail', '<p>Pas-à-pas illustré pour le ping : <a href="/pages/astuce-pare-feu-ping">Autoriser le ping (ICMP) dans le pare-feu</a>.</p>'),
  fig('/uploads/mr0g4oj9-g9mccy-pare-feu-ouvrir.png', 'Ouvrir le pare-feu : menu Démarrer → rechercher « pare-feu » → « Pare-feu Windows Defender avec fonctions avancées de sécurité ».'),
  fig('/uploads/mr0g4ooy-9dmtz9-pare-feu-regle-entrante-echo.png', 'Règles de trafic ENTRANT : activer une règle de demande d’écho (ici « Analyse de l’ordinateur virtuel - Trafic entrant ICMPv4/ICMPv6 »).'),
  fig('/uploads/mr0g4ox0-nswv2u-pare-feu-regle-sortante-echo.png', 'Règles de trafic SORTANT : la demande d’écho ICMP (« Diagnostics de réseau de base ») côté machine qui émet le ping.'),

  block('heading', { level: 2, text: '8️⃣ Redémarrer' }),
  block('html', { html: '<p>Tout est prêt (nom + IP + pare-feu) : <strong>redémarre maintenant</strong> la VM pour appliquer le changement de nom et valider la configuration. C’est le <strong>seul</strong> redémarrage nécessaire.</p>' }),
  fig('/uploads/mr0gltr6-hy72bw-vm-redemarrer.png', 'Menu Démarrer → « Arrêter ou se déconnecter » → « Redémarrer ».'),
  shot('Après redémarrage : sysdm.cpl confirme le nouveau nom ; ipconfig confirme l’IP fixe.'),

  block('heading', { level: 2, text: '9️⃣ Début du TP / réalisation / exercice' }),
  block('html', { html: '<p>La VM est <strong>opérationnelle et identifiable</strong> sur le réseau. Avant d’attaquer le TP, <strong>fais un instantané (snapshot)</strong> Hyper-V : tu pourras revenir à cet état propre en cas d’erreur.</p>' }),
  fig('/uploads/mr0fkmrm-2jxm6g-vm-instantane-point-controle.png', 'Gestionnaire Hyper-V → clic droit sur la VM → « Point de contrôle » (instantané), pour pouvoir revenir à cet état propre.'),
  note('green', '🎯 Et ensuite ?', '<p>Enchaîne sur le TP visé, par exemple : <a href="/pages/procedure-installation-active-directory">installer & configurer Active Directory</a> ou <a href="/pages/hebergement-web">mettre en place l’hébergement web (DNS + IIS)</a>. <strong>Rappel de l’ordre :</strong> créer la VM → installer l’OS → renommer → (reporter le redémarrage) → ncpa.cpl → IP fixe → pare-feu → redémarrer → TP.</p>'),
];

const PAGE = {
  slug: SLUG,
  title: 'Créer & configurer une VM (ISO) sur Hyper-V',
  excerpt: 'Procédure complète : créer une VM Hyper-V depuis un ISO, installer l’OS, renommer le PC, reporter le redémarrage, configurer l’IP fixe (IP/MSR/passerelle/DNS) via ncpa.cpl, ouvrir le pare-feu, redémarrer, puis démarrer le TP.',
};

// ===================================================================================
// EXÉCUTION
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

  const cours = existing.find(e => e.slug === 'cours');
  if (cours) {
    const hubBlocks = buildHubBlocks();
    const r = await fetch(`${BASE}/api/admin/pages/${cours.id}`, { method: 'PUT', headers: h, body: JSON.stringify({ title: 'Cours', slug: 'cours', content: renderPageBlocksToHtml(hubBlocks), builder_json: serializePageBlocks(hubBlocks), published: 1 }) });
    console.log('HUB Cours', r.status, r.ok ? '(maj)' : await r.text());
  } else console.log('HUB Cours introuvable');

  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

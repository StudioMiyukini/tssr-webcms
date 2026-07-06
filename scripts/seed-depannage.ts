/* Section « Dépannage » : base de connaissances des problèmes rencontrés en TP / Réalisation,
   au format symptôme → contexte → cause → solution. Data-driven : pour ajouter un cas,
   ajoute une entrée dans TIPS et relance le script.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-depannage.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const SLUG = 'depannage';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);

// ===================================================================================
// LES CAS DE DÉPANNAGE — ajoute une entrée ici puis relance le script.
// ===================================================================================
type Tip = { id: string; icon: string; title: string; tags: string[]; contexte: string; symptome: string; cause: string; solution: string };
const TIPS: Tip[] = [
  {
    id: 'dhcp-basculement-partenaire',
    icon: '📶',
    title: 'DHCP — Erreur lors de la validation du serveur partenaire (basculement)',
    tags: ['DHCP', 'Active Directory', 'Basculement'],
    contexte: 'Configuration d’un <strong>basculement DHCP</strong> (failover) : on indique le serveur partenaire (ex. <code>srv-ad</code>) puis <em>Suivant</em>.',
    symptome: 'Une croix rouge apparaît avec le message « <strong>Erreur rencontrée lors de la validation du serveur partenaire</strong> ». Impossible de continuer l’assistant.',
    cause: 'Le serveur DHCP <strong>n’est pas membre du domaine Active Directory cible</strong>. Le basculement — comme l’autorisation DHCP — exige que le serveur soit <strong>joint au bon domaine AD</strong>.',
    solution: 'Joindre le serveur DHCP au domaine AD cible : <code>sysdm.cpl</code> → <em>Modifier…</em> → <strong>Membre d’un domaine</strong> → saisir <code>domaine.local</code> → redémarrer. Se reconnecter avec un <strong>compte du domaine</strong>, vérifier que le DHCP est <strong>autorisé dans l’AD</strong> (console DHCP → clic droit sur le serveur → <em>Autoriser</em>), puis relancer l’assistant de basculement.',
  },

  // ---- Réseau / IP ----
  {
    id: 'apipa-169', icon: '🌐', title: 'Adresse en 169.254.x.x (APIPA)', tags: ['Réseau', 'DHCP', 'IP'],
    contexte: 'Un poste devrait recevoir une IP par DHCP (ou en a une fixe).',
    symptome: '<code>ipconfig</code> affiche une adresse <code>169.254.x.x</code> et aucune connectivité.',
    cause: 'C’est l’<strong>APIPA</strong> : la carte n’a <strong>pas obtenu de configuration valide</strong> (serveur DHCP injoignable, câble/VLAN, ou IP statique non appliquée).',
    solution: 'Vérifier le lien physique et le VLAN, relancer <code>ipconfig /release</code> puis <code>ipconfig /renew</code>. Si le DHCP est absent, poser une <strong>IP fixe</strong> correcte. → <a href="/procedure-ip-fixe-windows">IP fixe</a>, <a href="/procedure-test-connectivite">test de connectivité</a>.',
  },
  {
    id: 'ping-nom-ko', icon: '🧭', title: 'Ping par IP OK mais par nom KO', tags: ['DNS', 'Réseau'],
    contexte: 'On joint une machine/un site par son IP mais pas par son nom.',
    symptome: '<code>ping 8.8.8.8</code> répond, <code>ping google.com</code> échoue (« hôte introuvable »).',
    cause: 'Problème de <strong>résolution DNS</strong> : mauvais serveur DNS configuré (souvent la box au lieu du <strong>DC</strong>), ou zone/enregistrement manquant.',
    solution: 'Mettre en <strong>DNS préféré l’IP du contrôleur de domaine</strong> (jamais la box sur un poste du domaine), vérifier la zone et l’enregistrement A. Test : <code>nslookup nom.domaine.local</code>. → <a href="/procedure-dns">DNS</a>, <a href="/procedure-ip-fixe-windows">IP fixe</a>.',
  },
  {
    id: 'conflit-ip', icon: '⚠️', title: 'Conflit d’adresses IP détecté', tags: ['Réseau', 'DHCP', 'IP'],
    contexte: 'Attribution d’IP statiques sur un réseau où tourne un DHCP.',
    symptome: '« <strong>Windows a détecté un conflit d’adresses IP</strong> » ; connectivité intermittente.',
    cause: 'Une IP fixe a été posée <strong>dans la plage distribuée par le DHCP</strong> sans l’exclure → deux machines avec la même IP.',
    solution: 'Choisir une IP <strong>hors de la plage DHCP</strong>, ou créer une <strong>exclusion</strong>/réservation dans l’étendue. → <a href="/procedure-dhcp">DHCP (exclusions & réservations)</a>.',
  },
  {
    id: 'pas-de-ping-lan', icon: '🚫', title: 'Deux postes du même réseau ne se pingent pas', tags: ['Réseau', 'Pare-feu'],
    contexte: 'Deux machines correctement adressées sur le même sous-réseau.',
    symptome: 'Le ping entre elles échoue (« délai d’attente dépassé »), alors que la passerelle répond.',
    cause: 'Le <strong>pare-feu Windows bloque l’ICMP</strong> (règle « écho entrant » désactivée), ou masque / sous-réseau incohérent.',
    solution: 'Autoriser le ping (règle <strong>ICMPv4 entrante</strong>) et vérifier que les deux sont bien dans le <strong>même sous-réseau</strong> (masque). → <a href="/astuce-pare-feu-ping">Autoriser le ping</a>, <a href="/procedure-test-connectivite">test de connectivité</a>.',
  },
  {
    id: 'pas-internet-lan-ok', icon: '🌍', title: 'Pas d’Internet mais le réseau local fonctionne', tags: ['Réseau', 'IP'],
    contexte: 'On atteint les machines locales mais aucun site externe.',
    symptome: '<code>ping</code> passerelle OK, <code>ping 8.8.8.8</code> échoue.',
    cause: '<strong>Passerelle par défaut absente ou erronée</strong> (ou routage / NAT défaillant en amont).',
    solution: 'Vérifier la <strong>passerelle</strong> (convention <code>.254</code>) dans <code>ipconfig /all</code> et la corriger. → <a href="/procedure-ip-fixe-windows">IP fixe</a>.',
  },

  // ---- Active Directory / domaine ----
  {
    id: 'jointure-dc-introuvable', icon: '🏢', title: 'Jointure au domaine : « contrôleur de domaine introuvable »', tags: ['Active Directory', 'DNS'],
    contexte: 'On tente de joindre un poste au domaine (<code>sysdm.cpl</code>).',
    symptome: '« <strong>Un contrôleur de domaine pour le domaine … est introuvable</strong> ».',
    cause: 'Le poste n’a pas le <strong>bon DNS</strong> : il doit interroger le <strong>DNS du domaine (le DC)</strong> pour trouver les enregistrements SRV du domaine.',
    solution: 'Mettre en <strong>DNS préféré l’IP du DC</strong>, vérifier <code>ping domaine.local</code> et l’heure. → <a href="/procedure-installation-active-directory">Installer AD</a>, <a href="/procedure-dns">DNS</a>.',
  },
  {
    id: 'kerberos-horloge', icon: '🕰️', title: 'Authentification qui échoue (horloge désynchronisée)', tags: ['Active Directory', 'Kerberos'],
    contexte: 'Connexion au domaine ou jointure d’un poste.',
    symptome: 'Échecs d’authentification, « accès refusé » alors que le mot de passe est correct.',
    cause: '<strong>Kerberos</strong> refuse un écart d’horloge supérieur à <strong>5 minutes</strong> entre le client et le DC.',
    solution: 'Synchroniser l’heure du poste sur celle du DC (référence de temps = rôle <strong>Émulateur PDC</strong>). → <a href="/administration-domaine-ad">Administration AD (FSMO)</a>.',
  },
  {
    id: 'relation-approbation-poste', icon: '🔗', title: '« La relation d’approbation entre ce poste et le domaine a échoué »', tags: ['Active Directory'],
    contexte: 'Ouverture de session sur un poste déjà membre du domaine.',
    symptome: 'Message au logon : relation d’approbation échouée ; impossible de se connecter avec un compte du domaine.',
    cause: 'Le <strong>canal sécurisé</strong> (mot de passe du compte ordinateur) est <strong>désynchronisé</strong> avec l’AD — fréquent après un clone/restauration ou une longue extinction.',
    solution: 'Se connecter en <strong>admin local</strong>, puis <strong>re-joindre le domaine</strong> (sortir en workgroup et rejoindre, ou réinitialiser le compte ordinateur). → <a href="/procedure-renommer-poste">Renommer / joindre un poste</a>.',
  },
  {
    id: 'gpo-non-appliquee', icon: '📜', title: 'Une GPO ne s’applique pas', tags: ['Active Directory', 'GPO'],
    contexte: 'Stratégie de groupe créée mais sans effet sur les postes/utilisateurs.',
    symptome: 'Le paramètre attendu n’apparaît pas côté client.',
    cause: 'GPO <strong>non liée à la bonne OU</strong>, <strong>filtrage de sécurité</strong> excluant la cible, ordre <strong>LSDOU</strong>, ou <strong>SYSVOL</strong> non répliqué.',
    solution: 'Vérifier la <strong>liaison à l’OU</strong> et le filtrage, forcer <code>gpupdate /force</code>, contrôler avec <code>gpresult /r</code>, vérifier la réplication SYSVOL. → <a href="/administration-domaine-ad">Administration AD (SYSVOL)</a>.',
  },
  {
    id: 'partage-acces-refuse', icon: '📁', title: 'Accès refusé à un dossier partagé (droits incohérents)', tags: ['NTFS', 'Partage'],
    contexte: 'Un utilisateur voit le partage mais ne peut pas y accéder ou y écrire.',
    symptome: '« Accès refusé » alors qu’il semble avoir les droits.',
    cause: 'Le droit effectif = <strong>le plus restrictif entre Partage et NTFS</strong>. Un « Lecture » côté partage bride un « Modifier » NTFS. Ou droit posé sur le mauvais groupe.',
    solution: 'Laisser le <strong>partage large</strong> et gérer le vrai contrôle en <strong>NTFS</strong>, sur le <strong>groupe Domaine Local</strong> (AGDLP). Un <strong>refus explicite</strong> l’emporte toujours. → <a href="/permissions-partage-ntfs">Partage/NTFS</a>, <a href="/procedure-agdlp">AGDLP</a>.',
  },

  // ---- DHCP / DNS / IIS ----
  {
    id: 'dhcp-pas-de-bail', icon: '📶', title: 'Les clients ne reçoivent pas d’adresse du DHCP', tags: ['DHCP', 'Active Directory'],
    contexte: 'Serveur DHCP configuré, clients en attribution automatique.',
    symptome: 'Les clients tombent en <strong>APIPA</strong> (169.254), aucun bail distribué.',
    cause: '<strong>Étendue non activée</strong>, <strong>DHCP non autorisé dans l’AD</strong>, ou clients sur un <strong>autre sous-réseau sans relais DHCP</strong>.',
    solution: 'Activer l’étendue, <strong>autoriser</strong> le serveur (console DHCP → clic droit → Autoriser), vérifier le sous-réseau / relais. → <a href="/procedure-dhcp">DHCP</a>.',
  },
  {
    id: 'iis-403', icon: '🕸️', title: 'Site IIS : erreur 403 / 401 (accès refusé)', tags: ['IIS', 'NTFS', 'Web'],
    contexte: 'Site publié dans IIS.',
    symptome: 'Le navigateur affiche <strong>403 Interdit</strong> ou <strong>401 Non autorisé</strong>.',
    cause: 'Les <strong>permissions NTFS</strong> du dossier n’autorisent pas le compte IIS (<code>IIS_IUSRS</code> / <code>IUSR</code>) en lecture, ou document par défaut / authentification mal réglés.',
    solution: 'Donner la <strong>lecture</strong> à <code>IIS_IUSRS</code> sur le dossier, vérifier le document par défaut et le mode d’authentification. → <a href="/procedure-iis">IIS</a>.',
  },
  {
    id: 'iis-inaccessible-client', icon: '🌐', title: 'Site IIS inaccessible depuis un client (OK en local)', tags: ['IIS', 'DNS', 'Pare-feu'],
    contexte: 'Le site répond sur <code>http://localhost</code> du serveur mais pas depuis un poste.',
    symptome: 'Depuis le client : « site inaccessible » / délai dépassé.',
    cause: '<strong>Enregistrement DNS A manquant</strong> pour le nom du site, ou <strong>port 80 bloqué</strong> par le pare-feu.',
    solution: 'Créer l’<strong>enregistrement A</strong> (nom → IP du serveur web), autoriser le <strong>port 80</strong> entrant, tester <code>nslookup www.domaine.local</code>. → <a href="/procedure-iis">IIS</a>, <a href="/procedure-dns">DNS</a>.',
  },

  // ---- Virtualisation / disques / accès distant ----
  {
    id: 'hyperv-vm-sans-reseau', icon: '🖥️', title: 'Une VM Hyper-V n’a pas de réseau', tags: ['Hyper-V', 'Réseau'],
    contexte: 'VM créée, mais aucune connectivité réseau.',
    symptome: 'Pas d’IP DHCP, ne ping personne, « câble réseau débranché » dans la VM.',
    cause: 'La <strong>carte réseau de la VM n’est pas connectée au bon commutateur virtuel</strong> (ou commutateur privé qui l’isole du réseau physique).',
    solution: 'Paramètres de la VM → <strong>Carte réseau</strong> → sélectionner le bon <strong>commutateur virtuel</strong>. → <a href="/procedure-hyperv-ressources">Hyper-V & ressources</a>.',
  },
  {
    id: 'hyperv-vm-boot-cpu', icon: '🧩', title: 'VM : CPU/RAM grisés, ou « No bootable device »', tags: ['Hyper-V'],
    contexte: 'Configuration ou premier démarrage d’une VM.',
    symptome: 'Les champs processeur / mémoire sont <strong>grisés</strong> ; ou la VM affiche « <strong>No operating system / bootable device</strong> ».',
    cause: 'CPU/RAM se règlent <strong>VM éteinte</strong>. Pour le boot : <strong>ISO non montée</strong>, <strong>ordre de démarrage</strong> incorrect, ou disque non initialisé.',
    solution: 'Éteindre la VM pour ajuster CPU/RAM ; monter l’<strong>ISO</strong> et placer le DVD/disque en tête de l’<strong>ordre de démarrage</strong> (firmware). → <a href="/procedure-hyperv-ressources">Hyper-V</a>, <a href="/procedure-vm-hyperv">Créer une VM</a>.',
  },
  {
    id: 'disque-invisible-etendre', icon: '💽', title: 'Disque ajouté invisible, ou « Étendre le volume » grisé', tags: ['Disques', 'Windows'],
    contexte: 'Ajout d’un disque (VHDX) ou extension d’une partition.',
    symptome: 'Le disque n’apparaît pas dans l’Explorateur ; ou <em>Étendre le volume</em> est <strong>grisé</strong>.',
    cause: 'Disque <strong>non initialisé / hors ligne</strong> ; l’extension exige un <strong>espace non alloué contigu</strong> juste après le volume.',
    solution: 'Dans <code>diskmgmt.msc</code> : initialiser (MBR/GPT), créer/formater le volume ; pour étendre, libérer un espace contigu. → <a href="/procedure-gestion-disques">Gestion des disques</a>.',
  },
  {
    id: 'ntfs-heritage-verrouille', icon: '🔒', title: 'Dossier verrouillé après désactivation de l’héritage NTFS', tags: ['NTFS', 'Sécurité', 'AGDLP'],
    contexte: 'Héritage NTFS désactivé sur un dossier ; les droits Administrateurs/Système ont été retirés (ou l’<code>icacls</code> de re-grant a échoué).',
    symptome: 'Onglet <em>Sécurité</em> : « <strong>Vous devez disposer d’autorisations d’accès en lecture pour afficher les propriétés de cet objet</strong> ». Impossible d’administrer ; parfois des <strong>comptes inconnus (SID)</strong> à la place des groupes.',
    cause: 'Casser l’héritage (<code>icacls /inheritance:r</code>) supprime <strong>toutes</strong> les autorisations héritées, dont <strong>Administrateurs</strong> et <strong>Système</strong>. Si elles ne sont pas re-données explicitement, plus personne n’a la main. Les groupes de domaine absents (ex. après <strong>restauration de snapshot</strong>) s’affichent en SID.',
    solution: 'Invite de commandes <strong>en administrateur</strong> : reprendre la propriété puis réinitialiser l’ACL — <code>takeown /f "C:\\Partages\\MonDossier" /r</code> puis <code>icacls "C:\\Partages\\MonDossier" /reset /t /c</code> (le dossier ré-hérite du parent). Nettoyer un SID orphelin : <code>icacls "…" /remove:g *S-1-5-21-…</code>. Recréer d’abord les <strong>groupes AD</strong> (script ①) <strong>avant</strong> de réappliquer le NTFS (script ②).',
  },
  {
    id: 'cisco-enable-no-password', icon: '🔑', title: 'Cisco : « enable » refusé après SSH (% No password set)', tags: ['Cisco', 'SSH', 'Packet Tracer'],
    contexte: 'Connecté en <strong>SSH</strong> à un routeur/switch (invite <code>R2&gt;</code>), on tape <code>enable</code> pour passer en mode privilégié.',
    symptome: '<code>enable</code> répond « <strong>% No password set.</strong> » et reste en mode utilisateur ; <code>show run</code> renvoie « <em>Invalid input</em> » (normal en mode utilisateur).',
    cause: 'Depuis une session <strong>VTY/SSH</strong>, IOS <strong>interdit</strong> le passage en mode privilégié s’il n’y a <strong>aucun mot de passe enable</strong> configuré (sécurité — contrairement à la console). De plus, le compte SSH n’a pas le <strong>niveau de privilège 15</strong>.',
    solution: 'Sur l’équipement (en mode privilégié via la <strong>console</strong>), deux options : <strong>(1)</strong> définir un mot de passe enable → <code>configure terminal</code> puis <code>enable secret MonSecret</code> → <code>enable</code> marchera ensuite en SSH ; <strong>(2, plus simple)</strong> donner le <strong>privilège 15</strong> au compte → <code>username admin privilege 15 secret MonMdp</code> → la session SSH arrive <strong>directement</strong> en mode privilégié (<code>R2#</code>), sans <code>enable</code>. Détails : <a href="/procedure-ssh-packet-tracer">SSH sur Packet Tracer</a>.',
  },
  {
    id: 'rdp-refuse', icon: '🖥️', title: 'Connexion Bureau à distance (RDP) refusée', tags: ['RDP', 'Pare-feu'],
    contexte: 'Prise en main à distance d’un poste ou d’un serveur.',
    symptome: '« Impossible de se connecter » / délai dépassé en RDP (<code>mstsc</code>).',
    cause: '<strong>Bureau à distance non activé</strong>, <strong>port 3389 bloqué</strong> par le pare-feu, ou l’utilisateur n’est pas dans les autorisés.',
    solution: 'Activer le Bureau à distance, ouvrir le <strong>port 3389</strong>, ajouter l’utilisateur aux comptes autorisés. → <a href="/astuce-bureau-a-distance">Activer le RDP</a>.',
  },
];

// ===================================================================================
// RENDU
// ===================================================================================
const style = `<style>
.dep-card{border:1px solid var(--border);border-left:4px solid #dc2626;border-radius:12px;background:var(--surface);padding:14px 16px;margin:12px 0;scroll-margin-top:80px}
.dep-head{display:flex;align-items:center;gap:10px}
.dep-ico{font-size:22px}
.dep-title{font-weight:800;font-size:16px}
.dep-tags{margin:6px 0 10px}
.dep-tag{display:inline-block;font-size:11px;font-weight:700;color:var(--text-muted);background:var(--surface-2);border:1px solid var(--border);border-radius:999px;padding:2px 10px;margin:3px 5px 0 0}
.dep-row{margin:8px 0;line-height:1.6;font-size:14px}
.dep-row .dep-k{display:inline-block;font-weight:800;font-size:11.5px;letter-spacing:.5px;text-transform:uppercase;padding:1px 8px;border-radius:6px;margin-right:6px}
.dep-symp .dep-k{background:rgba(220,38,38,.12);color:#dc2626}
.dep-ctx .dep-k{background:var(--surface-2);color:var(--text-muted)}
.dep-cause .dep-k{background:rgba(217,119,6,.12);color:#b45309}
.dep-sol .dep-k{background:rgba(22,163,74,.12);color:#15803d}
.dep-sol{background:rgba(22,163,74,.05);border-radius:8px;padding:8px 10px}
.dep-code{font-family:ui-monospace,'Space Mono',monospace}
</style>`;

function card(t: Tip): string {
  return `<div class="dep-card" id="dep-${t.id}">`
    + `<div class="dep-head"><span class="dep-ico">${t.icon}</span><span class="dep-title">${t.title}</span></div>`
    + `<div class="dep-tags">${t.tags.map(x => `<span class="dep-tag">${x}</span>`).join('')}</div>`
    + `<div class="dep-row dep-ctx"><span class="dep-k">Contexte</span>${t.contexte}</div>`
    + `<div class="dep-row dep-symp"><span class="dep-k">❌ Symptôme</span>${t.symptome}</div>`
    + `<div class="dep-row dep-cause"><span class="dep-k">🔍 Cause</span>${t.cause}</div>`
    + `<div class="dep-row dep-sol"><span class="dep-k">✅ Solution</span>${t.solution}</div>`
    + `</div>`;
}

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'TSSR · Base de connaissances', title: 'Dépannage', subtitle: 'Les problèmes rencontrés en TP et leur résolution — pour ne pas rester bloqué deux fois sur la même erreur.' }),
  block('html', { html: `<p class="meta">${TIPS.length} cas documenté(s). Format : contexte → symptôme → cause → solution. Utilise la recherche du site (🔍) pour retrouver un message d’erreur.</p>` }),
  block('html', { html: style + TIPS.map(card).join('') }),
];

const PAGE = {
  slug: SLUG,
  title: 'Dépannage',
  excerpt: 'Base de connaissances des problèmes rencontrés en TP/Réalisation et leur résolution (symptôme, cause, solution).',
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

  // Entrée de menu « Dépannage »
  const menus = await (await fetch(`${BASE}/api/admin/menus`, { headers: { Cookie: cookie } })).json() as Array<{ id: number; label: string; url: string }>;
  if (!menus.some(m => m.url === '/pages/depannage' || m.label === 'Dépannage')) {
    const r = await fetch(`${BASE}/api/admin/menus`, { method: 'POST', headers: h, body: JSON.stringify({ label: 'Dépannage', url: '/pages/depannage', sort_order: 4 }) });
    console.log('MENU Dépannage', r.status, r.ok ? '(ajouté)' : await r.text());
  } else console.log('MENU Dépannage déjà présent');

  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

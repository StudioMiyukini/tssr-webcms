/* Source de vérité UNIQUE du hub « Exercices » (quiz, exercices, jeux).
   Affichage mobile-first et responsive : cartes tactiles pleine largeur, et les quiz sont
   regroupés par domaine dans des sections repliables (<details>) pour éviter un long scroll.
   Les futurs scripts ajoutent leurs entrées dans EX_CATEGORIES → aucune divergence. */
import { makePageBlock, type PageBlock } from '../client/src/lib/page-blocks';
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);

export type ExItem = { href: string; title: string; desc: string };
export type ExCategory = { icon: string; name: string; intro: string; soon: string; items: ExItem[] };

export const EX_CATEGORIES: ExCategory[] = [
  {
    icon: '📝', name: 'Quiz', intro: 'Un quiz par cours — 3 séries de questions, correction immédiate. Touche un domaine pour dérouler ses quiz.',
    soon: 'Les premiers quiz arrivent bientôt.',
    items: [],
  },
  {
    icon: '🧩', name: 'Exercices', intro: 'Exercices interactifs et études de cas pour mettre la théorie en pratique.',
    soon: 'D’autres exercices arrivent bientôt.',
    items: [
      { href: '/pages/jeu-binaire', title: 'Le jeu du binaire', desc: 'Active les bits pour atteindre le nombre cible (façon Cisco).' },
      { href: '/pages/jeu-adressage-ip', title: 'Adressage IP : même réseau ?', desc: '10 cas : sous-réseaux, nombre magique, VLSM, APIPA, wildcard.' },
      { href: '/pages/jeu-linux-droits', title: 'Linux : lis les droits', desc: '10 sorties de ls -l / getfacl : qui peut quoi, quel chmod, masque des ACL.' },
      { href: '/pages/jeu-dmz-flux', title: 'DMZ : autorisé ou bloqué ?', desc: '10 flux à trancher avec la matrice de flux d’une DMZ.' },
      { href: '/pages/jeu-cisco-erreur', title: 'Cisco : où est l’erreur ?', desc: '10 extraits de CLI à corriger : interfaces, routes, NAT, ACL, VLAN.' },
    ],
  },
  {
    icon: '🎮', name: 'Jeux', intro: 'Des défis ludiques pour réviser sans s’ennuyer.',
    soon: 'D’autres jeux arrivent bientôt.',
    items: [
      { href: '/pages/jeu-schema-reseau', title: 'Trouve le bon schéma réseau', desc: '10 diapos : choisis le bon schéma parmi trois.' },
      { href: '/pages/jeu-reconnaitre-materiel', title: 'Reconnais le matériel', desc: '8 photos : identifie le composant PC ou réseau.' },
      { href: '/pages/jeu-incidents-tssr', title: 'Visual novel : Incidents TSSR', desc: '7 cas pratiques (1 par couche OSI), bons/mauvais choix.' },
      { href: '/pages/jeu-lire-schema-reseau', title: 'Lis le schéma réseau', desc: '10 schémas : zones, équipements et flux à reconnaître (pare-feu, DMZ, VLAN).' },
      { href: '/pages/jeu-vlan-ports', title: 'VLAN : quel port, quel mode ?', desc: '10 cas : access/trunk, natif, allowed, VTP, port-security, VLAN voix.' },
      { href: '/pages/jeu-opnsense-regles', title: 'OPNsense : la règle qui manque', desc: '10 écrans : ordre des règles, bon onglet, NAT et règle associée.' },
      { href: '/pages/jeu-linux-commande', title: 'Linux : la bonne commande', desc: '10 situations en terminal : services, réseau, disques, journaux.' },
      { href: '/pages/jeu-lire-capture', title: 'Lis la capture (Wireshark)', desc: '10 captures : ARP, DNS, ICMP, TLS, SMTP, SSH, DHCP, RADIUS, FTP.' },
      { href: '/pages/jeu-windows-ad', title: 'Windows & AD : quel outil, quelle étape ?', desc: '10 écrans : GPO, NTFS, profils, lecteurs réseau, RDP, quotas, FSMO.' },
    ],
  },
];

// Regroupement des quiz par domaine (pour un affichage mobile clair, repliable)
export const QUIZ_DOMAINS: Array<[string, string[]]> = [
  ['🔧 Hardware', ['hardware', 'les-form-factor', 'carte-mere', 'ports-arriere-carte-mere', 'le-chipset', 'le-processeur', 'le-raid']],
  ['💾 Software', ['histoire-de-windows', 'le-systeme-exploitation', 'demarrage-bios-uefi', 'systemes-de-fichiers', 'msconfig-configuration-systeme', 'gestion-ordinateur-windows', 'base-de-registre', 'cmd-et-powershell', 'windows-server', 'roles-windows-server', 'gestionnaire-de-serveurs', 'virtualisation', 'virtualisation-theorie', 'tp2-virtualisation-hyperv']],
  ['🪟 Windows Server & Active Directory', ['vocabulaire-active-directory', 'administration-domaine-ad', 'cours-gpo', 'permissions-partage-ntfs', 'gestion-avancee-utilisateurs', 'lecteurs-reseau', 'profils-itinerants', 'hebergement', 'hebergement-web', 'astuce-pare-feu-ping', 'astuce-bureau-a-distance']],
  ['🌐 Réseau', ['bases-du-reseau', 'adresses-ip', 'ip-et-binaire', 'calcul-ip-masque', 'segmentation-sous-reseaux', 'trouver-plage-ip-cidr', 'adresses-mac', 'notions-complementaires', 'le-routeur', 'le-switch', 'les-vlan', 'vlan-securite', 'vlan-vtp', 'vlan-voix', 'tcp-et-udp', 'le-ssh', 'la-messagerie', 'le-vpn', 'radius-8021x', 'le-wireshark', 'schemas-infrastructure', 'reseau-entreprise', 'tp1-presentation-cybercafe']],
  ['🧱 Pare-feu, OPNsense & DMZ', ['le-pare-feu', 'opnsense', 'opnsense-nat', 'opnsense-services', 'opnsense-segmentation', 'opnsense-vpn-ids', 'dmz', 'dmz-mise-en-place', 'dmz-surveillance-entretien']],
  ['🖧 Cisco Packet Tracer', ['cisco-routeur-cli', 'cisco-route-statique', 'cisco-nat', 'cisco-acl']],
  ['🐧 Linux', ['linux-bases', 'linux-redhat', 'linux-commandes-base', 'linux-paquets-essentiels', 'linux-droits', 'linux-acl', 'linux-bash', 'linux-disques', 'linux-archivage', 'linux-systemd', 'linux-cron-logs', 'linux-reseau', 'linux-ssh', 'linux-apache', 'linux-apache-virtualhosts', 'linux-samba', 'linux-proftpd']],
  ['🛠️ Maintenance & exploitation', ['les-7-couches-osi', 'le-ticketing', 'supervision']],
  ['🗣️ Anglais', ['anglais-professionnel']],
];
const slugOf = (href: string) => href.replace(/^\/pages\/quiz-/, '');
const esc = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const HUB_STYLE = `<style>
.exh-cat{margin:22px 0 8px;padding:11px 14px;border-radius:12px;background:var(--surface-2);border:1px solid var(--border)}
.exh-cat h2{margin:0;font-size:18px}
.exh-cat .meta{margin:4px 0 0}
.exh-grid{display:grid;grid-template-columns:1fr;gap:10px;margin:8px 0}
@media(min-width:560px){.exh-grid{grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}}
.exh-card{display:flex;flex-direction:column;gap:3px;padding:14px;border:1px solid var(--border);border-radius:12px;background:var(--surface);text-decoration:none;min-height:56px}
.exh-card:hover,.exh-card:active{border-color:#2563eb}
.exh-card .t{font-weight:600;color:var(--text)}
.exh-card .d{font-size:13px;color:#64748b}
.exh-dom{margin:8px 0;border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--surface)}
.exh-dom>summary{padding:14px;font-weight:600;cursor:pointer;list-style:none;display:flex;align-items:center;gap:10px}
.exh-dom>summary::-webkit-details-marker{display:none}
.exh-dom>summary .arr{margin-left:auto;color:#64748b;transition:transform .15s}
.exh-dom[open]>summary{border-bottom:1px solid var(--border);background:var(--surface-2)}
.exh-dom[open]>summary .arr{transform:rotate(90deg)}
.exh-dom .exh-grid{padding:0 12px 12px}
.exh-count{font-size:12px;font-weight:700;color:#fff;background:#2563eb;border-radius:999px;padding:1px 9px}
</style>`;

const card = (it: ExItem) => `<a class="exh-card" href="${esc(it.href)}"><span class="t">${esc(it.title)}</span><span class="d">${esc(it.desc)}</span></a>`;

/** Construit les blocs du hub « Exercices » (hero + sections par format, quiz repliables par domaine). */
export function buildExercicesHub(): PageBlock[] {
  const total = EX_CATEGORIES.reduce((n, c) => n + c.items.length, 0);
  const parts: string[] = [HUB_STYLE];

  for (const c of EX_CATEGORIES) {
    parts.push(`<div class="exh-cat"><h2>${c.icon} ${esc(c.name)}</h2><p class="meta">${esc(c.intro)}</p></div>`);
    if (!c.items.length) {
      parts.push(`<aside class="pb-note pb-note-blue"><p class="pb-note-title">🚧 Bientôt</p><p>${esc(c.soon)}</p></aside>`);
      continue;
    }
    if (c.name === 'Quiz') {
      const used = new Set<string>();
      let first = true;
      for (const [domLabel, slugs] of QUIZ_DOMAINS) {
        const its = c.items.filter(it => slugs.includes(slugOf(it.href)));
        its.forEach(it => used.add(it.href));
        if (!its.length) continue;
        parts.push(`<details class="exh-dom"${first ? ' open' : ''}><summary>${domLabel}<span class="exh-count">${its.length}</span><span class="arr">▸</span></summary><div class="exh-grid">${its.map(card).join('')}</div></details>`);
        first = false;
      }
      const rest = c.items.filter(it => !used.has(it.href));
      if (rest.length) parts.push(`<details class="exh-dom"${first ? ' open' : ''}><summary>📚 Autres<span class="exh-count">${rest.length}</span><span class="arr">▸</span></summary><div class="exh-grid">${rest.map(card).join('')}</div></details>`);
    } else {
      parts.push(`<div class="exh-grid">${c.items.map(card).join('')}</div>`);
    }
  }

  return [
    block('hero', { eyebrow: 'TSSR', title: 'Exercices', subtitle: 'Teste et consolide tes connaissances : quiz, exercices et jeux.' }),
    block('html', { html: `<p class="meta">Choisis un format pour t’entraîner.${total ? ` ${total} activité${total > 1 ? 's' : ''} au total.` : ' De nouveaux contenus arrivent régulièrement.'}</p>` }),
    block('html', { html: parts.join('') }),
  ];
}

/* Procédure « Plateforme 1 — montage de l'infrastructure EDIVN ».
   Guide pas-à-pas réutilisable, destiné à une équipe qui doit monter l'infra.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-procedure-plateforme-1.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = { slug: 'procedure-plateforme-1', title: 'Plateforme 1 — montage de l’infrastructure EDIVN', excerpt: 'Procédure complète et applicable pour monter le réseau de l’École de Développement Informatique (EDIVN) : plan d’adressage, puis 8 étapes couleur (reset, routeur interne + SSH, VM Hyper-V, switches, câblage, serveur DNS/Web/IIS, DHCP + relais, routage inter-routeurs + NAT/PAT, Wi-Fi), tests de validation et dépannage.' };

const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const th = (t: string) => `<th style="border:1px solid var(--border);padding:7px 10px;text-align:left;background:var(--surface-2)">${t}</th>`;
const td = (t: string) => `<td style="border:1px solid var(--border);padding:7px 10px">${t}</td>`;
const tbl = (head: string[], rows: string[][]) => `<div style="overflow-x:auto;margin:6px 0"><table style="border-collapse:collapse;width:100%;min-width:440px;font-size:13px"><thead><tr>${head.map(th).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(td).join('')}</tr>`).join('')}</tbody></table></div>`;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cmd = (t: string) => block('html', { html: `<div class="proc-cmd">${esc(t)}</div>` });
// Liste HTML (les items peuvent contenir des balises — contrairement au bloc « list » qui les échappe).
const ul = (items: string[]) => block('html', { html: `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>` });

// Bandeau d'étape coloré (couleur = repère visuel de l'étape).
const step = (n: string, title: string, sub: string, color: string) => block('html', { html: `<div class="step-banner" style="border-left-color:${color}"><span class="step-num" style="background:${color}">${n}</span><span class="step-tt"><h3 id="etape-${n}">${title}</h3><span class="step-sub">${sub}</span></span></div>` });

const C = { reset: '#64748b', routeur: '#3b82f6', vm: '#8b5cf6', switch: '#0ea5e9', cable: '#f59e0b', serveur: '#22c55e', dhcp: '#f97316', nat: '#ef4444', wifi: '#6366f1' };
// Rail vertical coloré courant le long du contenu d'une étape (rappel visuel de l'étape en cours).
const railOpen = (color: string) => block('html', { html: `<div class="step-rail" style="border-left-color:${color}">` });
const railClose = block('html', { html: '</div>' });

const styleBlock = block('html', { html: `<style>
.proc-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.55}
.step-banner{display:flex;align-items:center;gap:14px;margin:32px 0 12px;padding:13px 16px;border:1px solid var(--border);border-left-width:6px;border-radius:12px;background:var(--surface-2)}
.step-banner .step-num{flex:0 0 auto;width:36px;height:36px;border-radius:10px;display:grid;place-items:center;font-weight:700;color:#fff;font-size:16px;line-height:1}
.step-banner .step-tt{display:flex;flex-direction:column;gap:2px;min-width:0}
.step-banner h3{margin:0;font-size:17px;line-height:1.25}
.step-banner .step-sub{font-size:12.5px;color:var(--muted,#7a8699);font-weight:400}
.pb-acc{border:1px solid var(--border);border-radius:10px;margin:10px 0;overflow:hidden;background:var(--surface-2)}
.pb-acc>summary{cursor:pointer;padding:12px 16px;font-weight:600;font-size:14.5px;list-style:none;display:flex;align-items:center;gap:10px}
.pb-acc>summary::-webkit-details-marker{display:none}
.pb-acc>summary::before{content:'▶';font-size:10px;color:var(--muted,#7a8699);transition:transform .15s;flex:0 0 auto}
.pb-acc[open]>summary::before{transform:rotate(90deg)}
.pb-acc[open]>summary{border-bottom:1px solid var(--border)}
.pb-acc-body{padding:6px 16px 12px}
.pb-acc-body>*:first-child{margin-top:8px}
.step-rail{border-left:4px solid var(--border);padding:2px 0 2px 16px;margin:0 0 10px 4px}
.step-rail>*:first-child{margin-top:6px}
.proc-shot{margin:14px 0 18px}
.ps-wrap{position:relative;display:inline-block;max-width:100%;line-height:0}
.ps-wrap img{display:block;max-width:100%;border:1px solid var(--border);border-radius:8px}
.ps-mark{position:absolute;border:3px solid #e11d48;border-radius:6px;pointer-events:none}
.ps-mark.round{border-radius:50%}
.ps-num{position:absolute;top:-13px;left:-13px;width:24px;height:24px;border-radius:50%;background:#e11d48;color:#fff;font-weight:700;font-size:13px;display:grid;place-items:center;line-height:1;box-shadow:0 1px 4px rgba(0,0,0,.45)}
.ps-legend{margin:8px 0 0;padding:0;list-style:none;font-size:13.5px;line-height:1.55}
.ps-legend li{margin:4px 0}
.ps-b{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:#e11d48;color:#fff;font-weight:700;font-size:11.5px;margin-right:7px;vertical-align:-4px}
.tuto-step{display:flex;align-items:center;gap:10px;margin:22px 0 8px;font-weight:800;font-size:16px}
.tuto-step .tn{flex:0 0 auto;width:30px;height:30px;border-radius:50%;background:var(--accent);color:#fff;display:grid;place-items:center;font-size:14px}
/* Fenêtres Windows simulées (couleurs figées : un dialogue Windows reste clair) */
.simwin{display:inline-block;max-width:100%;width:520px;background:#f0f0f0;border:1px solid #6f6f6f;border-radius:7px;box-shadow:0 10px 30px rgba(0,0,0,.28);font-family:"Segoe UI",Tahoma,sans-serif;font-size:12.5px;color:#111;text-align:left;overflow:hidden;margin:12px auto}
.simwin *{box-sizing:border-box}
.sw-tb{display:flex;align-items:center;gap:8px;background:#fff;border-bottom:1px solid #dcdcdc;padding:7px 10px}
.sw-tb .i{font-size:14px}.sw-tb .t{font-weight:600;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sw-tb .x{color:#999}
.sw-bd{padding:14px 16px;background:#f0f0f0}
.sw-ft{display:flex;justify-content:flex-end;gap:8px;padding:9px 12px;border-top:1px solid #e2e2e2}
.sw-btn{min-width:72px;text-align:center;padding:4px 12px;border:1px solid #adadad;border-radius:3px;background:linear-gradient(#fdfdfd,#e7e7e7);font-size:12.5px}
.sw-btn.def{border-color:#2b7de0;box-shadow:0 0 0 1px #cfe4ff inset}
.sw-radio{display:flex;align-items:flex-start;gap:7px;margin:5px 0}
.sw-row{display:flex;align-items:center;gap:10px;margin:6px 0;flex-wrap:wrap}
.sw-row>.l{flex:0 0 150px;text-align:left}
.sw-in{border:1px solid #7a7a7a;background:#fff;padding:3px 8px;font-size:12.5px;color:#111;display:inline-block}
.sw-ip{display:inline-flex;border:1px solid #7a7a7a;background:#fff;padding:3px 8px;font-family:ui-monospace,monospace}
.sw-sel{border:1px solid #7a7a7a;background:#fff;padding:3px 10px;display:inline-flex;align-items:center;min-width:210px}
.sw-sel::after{content:'▾';margin-left:auto;color:#555;padding-left:16px}
.kb{position:relative;outline:2.5px solid #e11d48;outline-offset:2px;border-radius:3px}
.kb-num{position:absolute;top:-12px;left:-12px;width:22px;height:22px;border-radius:50%;background:#e11d48;color:#fff;font-weight:700;font-size:12px;display:grid;place-items:center;line-height:1;box-shadow:0 1px 3px rgba(0,0,0,.4)}
.sw-wiz{display:block;background:#f0f0f0}
.sw-wiz-nav{display:flex;flex-wrap:wrap;align-items:center;gap:2px 6px;border-bottom:1px solid #ddd;padding:7px 10px;background:#fbfbfb}
.sw-wiz-nav .s{color:#9aa2ad;font-size:10.5px;line-height:1.45}
.sw-wiz-nav .s.on{color:#111;font-weight:700}
.sw-wiz-nav .s:not(:last-child)::after{content:'\\203A';margin-left:6px;color:#c4c4c4}
.sw-wiz-main{padding:12px 14px}
.sim-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:14px;align-items:start}
.sim-grid .proc-shot{margin:0}
.sim-grid .simwin{width:100%}
.wiz-carousel{margin:12px 0 18px;border:1px solid var(--border);border-radius:10px;overflow:hidden}
.wc-head{padding:9px 14px;font-weight:700;font-size:13.5px;border-bottom:1px solid var(--border);background:var(--surface-2);display:flex;flex-wrap:wrap;gap:4px 8px;align-items:baseline}
.wc-hint{font-weight:400;color:var(--text-muted);font-size:12px}
.carousel{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scroll-behavior:smooth;background:var(--surface)}
.carousel>figure{flex:0 0 100%;scroll-snap-align:start;margin:0;padding:16px 14px;box-sizing:border-box}
.carousel::-webkit-scrollbar{height:11px}
.carousel::-webkit-scrollbar-thumb{background:#b0b0b0;border-radius:10px;border:2px solid var(--surface)}
.carousel::-webkit-scrollbar-track{background:var(--surface-2)}
.net-card{border:1px solid var(--border);border-left:5px solid var(--nc,#2563eb);border-radius:12px;overflow:hidden;margin:14px 0;background:var(--surface-2)}
.net-card .nc-head{padding:12px 16px 10px}
.net-card .nc-title{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.net-card .nc-ic{font-size:20px;line-height:1}
.net-card .nc-name{font-weight:800;font-size:16px;color:var(--text)}
.net-card .nc-cidr{font-family:ui-monospace,'Space Mono',monospace;font-weight:700;font-size:13px;color:var(--nc,#2563eb);background:color-mix(in srgb,var(--nc,#2563eb) 14%,transparent);border:1px solid color-mix(in srgb,var(--nc,#2563eb) 35%,transparent);border-radius:999px;padding:2px 11px}
.net-card .nc-facts{display:flex;flex-wrap:wrap;gap:7px 18px;margin-top:10px}
.net-card .nc-facts>span{font-size:12.5px}
.net-card .nc-k{color:var(--text-muted)}
.net-card .nc-v{font-family:ui-monospace,'Space Mono',monospace;font-weight:600;color:var(--text)}
.net-card .nc-body{padding:0 12px 12px}
.net-card .nc-body>div{margin:0}
.net-card .nc-cap{font-size:11.5px;color:var(--text-muted);padding:0 16px 12px}
.wiz-stack{border:1px solid var(--border);border-radius:10px;overflow:hidden;margin:12px 0;background:var(--surface-2)}
.wiz-stack>.wc-head{padding:9px 14px;font-weight:700;font-size:13.5px;border-bottom:1px solid var(--border)}
.wiz-stack>figure{margin:12px 14px}
.dp-break{display:none}
</style>` });

const figure = (url: string, cap: string) => block('html', { html: `<figure style="margin:12px 0 16px;text-align:center"><img src="${url}" alt="${cap}" loading="lazy" style="max-width:100%;border:1px solid var(--border);border-radius:8px"/><figcaption class="meta" style="margin-top:6px;font-size:12.5px">${cap}</figcaption></figure>` });
// Titre d'étape « tutoriel » (pastille numérotée + intitulé simple).
const tstep = (n: string, title: string) => block('html', { html: `<div class="tuto-step"><span class="tn">${n}</span> ${title}</div>` });

// ── Fenêtres Windows SIMULÉES (HTML) : plus nettes que les captures, valeurs pré-remplies, points clés encadrés en rouge ──
const swBtns = '<span class="sw-btn def">OK</span><span class="sw-btn">Annuler</span>';
const swFrame = (icon: string, title: string, body: string, buttons: string = swBtns) =>
  `<div class="simwin"><div class="sw-tb"><span class="i">${icon}</span><span class="t">${title}</span><span class="x">✕</span></div><div class="sw-bd">${body}</div><div class="sw-ft">${buttons}</div></div>`;
const swIp = (v: string) => `<span class="sw-ip">${v.split('.').map(o => o.trim()).join('&nbsp; . &nbsp;')}</span>`;
const kbx = (n: number, html: string) => `<div class="kb"><span class="kb-num">${n}</span>${html}</div>`;
const rON = '<span style="font-size:13px">◉</span>', rOFF = '<span style="font-size:13px;color:#888">○</span>';
const cON = '<span style="font-size:13px">☑</span>', cOFF = '<span style="font-size:13px;color:#888">☐</span>';
// Fenêtre simulée + légende numérotée (pastilles rouges). Légende optionnelle.
const simWin = (winHtml: string, caption: string, legend: string[] = []) => block('html', {
  html: `<figure class="proc-shot" style="text-align:center">${winHtml}<figcaption class="meta" style="margin-top:6px;font-size:12.5px">${caption}</figcaption>`
    + (legend.length ? `<ol class="ps-legend" style="max-width:580px;margin:8px auto 0;text-align:left">${legend.map((l, i) => `<li><span class="ps-b">${i + 1}</span> ${l}</li>`).join('')}</ol>` : '') + '</figure>',
});
// Assistant page-par-page : volet d'étapes à gauche (étape courante en gras) + page à droite + boutons.
const wizBtns = (last = false) => `<span class="sw-btn">&lt; Précédent</span><span class="sw-btn def">${last ? 'Terminer' : 'Suivant &gt;'}</span><span class="sw-btn">Annuler</span>`;
const wizPage = (icon: string, title: string, steps: string[], cur: number, pageTitle: string, body: string, buttons: string) =>
  `<div class="simwin" style="width:600px"><div class="sw-tb"><span class="i">${icon}</span><span class="t">${title}</span><span class="x">✕</span></div>`
  + `<div class="sw-wiz"><div class="sw-wiz-nav">${steps.map((s, i) => `<div class="s${i === cur ? ' on' : ''}">${s}</div>`).join('')}</div>`
  + `<div class="sw-wiz-main"><p style="font-weight:700;margin:0 0 10px;font-size:13.5px">${pageTitle}</p>${body}</div></div>`
  + `<div class="sw-ft">${buttons}</div></div>`;
const VM_STEPS = ['Avant de commencer', 'Nom et emplacement', 'Génération', 'Affecter la mémoire', 'Mise en réseau', 'Disque dur virtuel', 'Options d’installation', 'Résumé'];
const DHCP_STEPS = ['Nom de l’étendue', 'Plage d’adresses IP', 'Ajout d’exclusions', 'Durée du bail', 'Configurer les options', 'Routeur (passerelle)', 'Domaine et serveurs DNS', 'Serveurs WINS', 'Activer l’étendue', 'Fin'];
// Accordéon repliable : regroupe des blocs HTML dans un <details>.
const acc = (summary: string, inner: PageBlock[]) => block('html', { html: `<details class="pb-acc"><summary>${summary}</summary><div class="pb-acc-body">${inner.map(b => (b as any).html || '').join('')}</div></details>` });
// Accordéon dont le corps dispose ses fenêtres en GRILLE (2 colonnes sur ordinateur, 1 sur mobile).
const accGrid = (summary: string, inner: PageBlock[]) => block('html', { html: `<details class="pb-acc" open><summary>${summary}</summary><div class="pb-acc-body sim-grid">${inner.map(b => (b as any).html || '').join('')}</div></details>` });
// Carrousel « pages » : une fenêtre visible à la fois, défilement / glissement horizontal (scroll-snap).
const carousel = (title: string, slides: PageBlock[]) => block('html', {
  html: `<div class="wiz-carousel"><div class="wc-head">${title}<span class="wc-hint">← glissez / faites défiler horizontalement pour changer d’écran →</span></div>`
    + `<div class="carousel">${slides.map(b => (b as any).html || '').join('')}</div></div>`,
});
// Groupe d'écrans d'assistant, empilés (les images restent individuelles en colonne).
const pager = (title: string, slides: PageBlock[]) => block('html', {
  html: `<div class="wiz-stack"><div class="wc-head">${title}</div>${slides.map(b => (b as any).html || '').join('')}</div>`,
});
// Marqueur de découpe en PAGES (sections) pour le lecteur « doc-pager ». data-label = titre de la page.
const pageBreak = (label: string) => block('html', { html: `<hr class="dp-break" data-label="${label.replace(/"/g, '')}">` });
// Carte « réseau » : bandeau coloré (nom + CIDR), faits clés (masque/plage/passerelle) et tableau des équipements.
const netCard = (color: string, icon: string, name: string, cidr: string, facts: [string, string][], head: string[], rows: string[][], caption = '') => block('html', {
  html: `<div class="net-card" style="--nc:${color}">`
    + `<div class="nc-head"><div class="nc-title"><span class="nc-ic">${icon}</span><span class="nc-name">${name}</span><span class="nc-cidr">${cidr}</span></div>`
    + `<div class="nc-facts">${facts.map(([k, v]) => `<span><span class="nc-k">${k} :</span> <span class="nc-v">${v}</span></span>`).join('')}</div></div>`
    + `<div class="nc-body">${tbl(head, rows)}</div>`
    + (caption ? `<div class="nc-cap">${caption}</div>` : '') + '</div>',
});

// ── Annexe 1 : machines virtuelles (relevé des configurations réelles) ──
// Colonne « Serveur » en bleu, colonne « Client » en vert, 1re colonne en gras.
const SRV_COL = '#2563eb', CLI_COL = '#16a34a';
const annexeRows: [string, string, string][] = [
  ['Nom de la VM', '<strong>SRV-1</strong>', '<strong>CLIENT10</strong>'],
  ['Rôles / usage', 'DNS · IIS · DHCP', 'poste client'],
  ['Système', 'Windows Server 2019', 'Windows 10 Pro'],
  ['Mémoire (RAM)', '4096 Mo', '4096 Mo'],
  ['Stockage', 'C : 50 Go', 'C : 40 Go'],
  ['Commutateur virtuel', 'Externe (commutateur 1)', 'Externe (commutateur 2)'],
  ['Adresse IP', '<strong>192.5.10.12</strong> /28', '192.5.10.1 /28'],
  ['Masque de sous-réseau', '255.255.255.240', '255.255.255.240'],
  ['Passerelle par défaut', '192.5.10.14', '192.5.10.14'],
  ['Serveur DNS', 'SRV-1 (192.5.10.12)', 'SRV-1 (192.5.10.12)'],
  ['Nom de domaine', 'edivn.lan', 'edivn.lan'],
];
const aTh = (t: string, color?: string) => `<th style="border:1px solid var(--border);padding:7px 10px;text-align:left;background:var(--surface-2)${color ? `;color:${color}` : ''}">${t}</th>`;
const aTd = (t: string, style: string) => `<td style="border:1px solid var(--border);padding:7px 10px;${style}">${t}</td>`;
const annexe1 = `<div style="overflow-x:auto;margin:6px 0"><table style="border-collapse:collapse;width:100%;min-width:440px;font-size:13px"><thead><tr>${aTh('Caractéristique')}${aTh('VM Serveur', SRV_COL)}${aTh('VM Poste client', CLI_COL)}</tr></thead><tbody>${annexeRows.map(r => `<tr>${aTd(r[0], 'font-weight:700')}${aTd(r[1], `color:${SRV_COL}`)}${aTd(r[2], `color:${CLI_COL}`)}</tr>`).join('')}</tbody></table></div>`;

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Procédure · Projet réseau', title: 'Plateforme EDIVN — montage de l’infrastructure', subtitle: '' }),
  styleBlock,
  block('html', { html: `<div data-block="pdf-download" data-title="Plateforme EDIVN — montage de l’infrastructure" data-label="Télécharger la procédure en PDF"></div>` }),

  pageBreak('Présentation & mission'),
  note('blue', '🏫 Contexte', '<p>L’<strong>École de Développement Informatique EDIVN</strong> forme des développeurs et souhaite <strong>restructurer son réseau</strong> pour gagner en efficacité et en sécurité. Dans le cadre de son agrandissement, chaque site dispose d’une équipe chargée de restructurer le réseau.</p>'),
  note('gray', '🧭 Comment lire cette procédure', '<p>Tutoriel pas-à-pas pour <strong>stagiaires TSSR</strong>. Suivez les <strong>8 étapes colorées</strong> dans l’ordre : chacune commence par un <strong>« 🎯 Objectif »</strong> (et ses <strong>prérequis</strong>). Pour les configurations <strong>Windows Server</strong>, chaque <strong>fenêtre d’assistant est reproduite</strong>, avec le <strong style="color:#e11d48">champ à renseigner encadré en rouge</strong> et une légende numérotée. Pour les <strong>routeurs/switches Cisco</strong>, la configuration est en <strong>ligne de commande (CLI)</strong> : blocs de commandes à saisir dans la console. Les exemples prennent le <strong>Groupe 5</strong> — remplacez le suffixe (<code>G5</code>, <code>05</code>) et le domaine par les vôtres.</p>'),

  block('heading', { level: 2, text: '🎯 Mission' }),
  block('html', { html: '<p>Afin de réaliser la restructuration demandée par l’EDIVN, le travail est mené en suivant la procédure ci-dessous :</p>' }),
  ul([
    'Configurer les routeurs : routage entre les <strong>deux réseaux de l’EDIVN</strong> (Admin et Utilisateurs) et vers l’<strong>extérieur</strong> (box Internet).',
    'Configurer les serveurs : mise en service des services <strong>DNS, DHCP et Web</strong>.',
    'Sécuriser le réseau : accès de management à distance en SSH sur les switches et les routeurs (mot de passe : <code>cisco</code>).',
    'Configurer le point d’accès sans-fil Cisco : Wi-Fi pour les utilisateurs.',
    'Accès Web : permettre l’accès au <strong>site public de l’EDIVN</strong> ainsi qu’à son <strong>intranet</strong>, pour les stagiaires et les administrateurs.',
  ]),

  block('heading', { level: 2, text: '📋 Cahier des charges (besoins)' }),
  block('heading', { level: 3, text: 'Sous-réseaux' }),
  ul([
    '<strong>Réseau Admin (IT)</strong> : postes des administrateurs + serveur DNS/Web.',
    '<strong>Réseau Utilisateurs</strong> : postes des formateurs et stagiaires.',
  ]),
  block('heading', { level: 3, text: 'Wi-Fi' }),
  block('html', { html: '<p>Un point d’accès <strong>Cisco WAP 371</strong> fournit le Wi-Fi aux stagiaires et formateurs, avec un <strong>SSID</strong> dédié <code>SSID-EDWINXX</code> et une attribution d’<strong>IP dynamiques par DHCP</strong>.</p>' }),
  block('heading', { level: 3, text: 'DHCP' }),
  block('html', { html: '<p>Un service <strong>DHCP</strong> gère l’attribution des configurations réseau pour <strong>l’ensemble du réseau</strong> de l’école.</p>' }),
  block('heading', { level: 3, text: 'Serveur Web (réseau IT, IP fixe)' }),
  block('html', { html: '<p>Hébergé dans le réseau IT, il héberge les sites de l’école. Deux sites à créer :</p>' }),
  ul([
    'Site 1 : <code>www.Groupe05-EDIVN.lan</code> sur le <strong>port 8080</strong>, accessible <strong>depuis l’extérieur</strong>.',
    'Site 2 (intranet) : <code>Intranet.05.EDIVN.lan</code>, accessible <strong>pour l’école</strong>, avec une page d’accueil « <em>Bienvenue sur le site de l’école EDIVN</em> ».',
  ]),
  block('heading', { level: 3, text: 'Switches & accès distant' }),
  ul([
    'Renommer <strong>l’ensemble des switches</strong>.',
    'Mettre en place une connexion à distance <strong>SSH</strong> sur les switches et les routeurs (mot de passe : <code>cisco</code>).',
  ]),

  block('heading', { level: 2, text: '📦 Livrables attendus (dossier technique)' }),
  ul([
    '<strong>Schéma logique</strong> : architecture réseau (sous-réseaux, équipements, interconnexions).',
    '<strong>Configuration des machines</strong> (Annexe 1).',
    '<strong>Configuration des switches et des routeurs</strong> (Annexe 2).',
    '<strong>Tables de routage</strong> : captures / listes des routes configurées.',
    '<strong>Borne Wi-Fi</strong> : captures montrant son fonctionnement.',
  ]),

  pageBreak('Plan d’adressage'),
  block('heading', { level: 2, text: '🗺️ Schéma logique & plan d’adressage' }),
  figure('/uploads/plat1-schema-reseau.png', 'Schéma logique EDIVN : réseau Admin/IT (192.5.10.0/28), réseau Utilisateurs (192.5.50.0/24), routeur interne R_IT_G5, routeur de bordure Routeur_G5 et sortie vers 172.16.3.0/24.'),
  block('html', { html: '<p>L’infrastructure repose sur <strong>trois réseaux</strong>. Chacun a sa <strong>carte</strong> ci-dessous : le sous-réseau (CIDR), ses <strong>chiffres clés</strong> (masque, plage utilisable, passerelle) et la liste des équipements avec leur adresse.</p>' }),

  netCard('#2563eb', '🏢', 'Réseau Admin / IT', '192.5.10.0 /28', [
    ['Masque', '255.255.255.240'], ['Plage utilisable', '.1 → .14'], ['Broadcast', '.15'], ['Passerelle', '192.5.10.14'],
  ], ['Équipement', 'Adresse IP', 'Rôle'], [
    ['Poste Admin 1', '192.5.10.1', 'poste administrateur'],
    ['Serveur DHCP-DNS-Web', '<strong>192.5.10.12</strong>', 'serveur (IP fixe)'],
    ['SW-1', '192.5.10.13', 'switch — IP de gestion'],
    ['Passerelle (R_IT_G5 Gi0/0)', '<strong>192.5.10.14</strong>', 'passerelle du réseau'],
  ], 'Petit réseau <strong>/28</strong> (16 adresses) réservé à l’administration et au serveur.'),

  netCard('#16a34a', '👥', 'Réseau Utilisateurs', '192.5.50.0 /24', [
    ['Masque', '255.255.255.0'], ['Pool DHCP', '.1 → .200'], ['IP fixes infra', '.251 → .254'], ['Passerelle', '192.5.50.254'],
  ], ['Équipement', 'Adresse IP', 'Rôle'], [
    ['Stagiaire', '192.5.50.1', 'poste — <strong>via DHCP</strong>'],
    ['Formateur', '192.5.50.2', 'poste — <strong>via DHCP</strong>'],
    ['CISCO WAP 371', '192.5.50.251', 'point d’accès Wi-Fi (SSID-EDWIN05) — IP fixe'],
    ['Routeur_G5 (LAN)', '192.5.50.252', 'routeur de bordure — IP fixe'],
    ['Sw-2', '192.5.50.253', 'switch — IP de gestion'],
    ['Passerelle (R_IT_G5 Gi0/1)', '<strong>192.5.50.254</strong>', 'passerelle du réseau'],
  ], 'Postes et clients Wi-Fi servis par <strong>DHCP</strong> (.1 → .200). Les IP fixes d’infra (.251 → .254) sont <strong>au-dessus du pool</strong> → aucune exclusion à faire.'),

  netCard('#f97316', '🌍', 'Liaison extérieure / salle', '172.16.3.0 /24', [
    ['Masque', '255.255.255.0'], ['Sortie WAN', '172.16.3.250'], ['Passerelle salle', '172.16.3.254'],
  ], ['Équipement', 'Adresse IP', 'Rôle'], [
    ['Routeur_G5 (WAN)', '172.16.3.250', 'sortie vers les autres écoles / Internet'],
    ['Passerelle de la salle', '172.16.3.254', 'route par défaut du routeur de bordure'],
  ], 'IP WAN et passerelle <strong>fournies par la salle</strong> — adaptez-les à votre poste.'),

  netCard('#8b5cf6', '🔀', 'Routeurs & interfaces', 'récapitulatif', [
    ['R_IT_G5', 'interne — route Admin ↔ Utilisateurs'], ['Routeur_G5', 'bordure — NAT/PAT vers la salle'],
  ], ['Routeur', 'Interface', 'Réseau', 'Adresse IP'], [
    ['R_IT_G5 (interne)', 'Gi0/0', 'Admin 192.5.10.0/28', '<strong>192.5.10.14</strong>'],
    ['R_IT_G5 (interne)', 'Gi0/1', 'Utilisateurs 192.5.50.0/24', '<strong>192.5.50.254</strong>'],
    ['Routeur_G5 (bordure)', 'Gi0/1', 'Utilisateurs 192.5.50.0/24', '192.5.50.252'],
    ['Routeur_G5 (bordure)', 'Gi0/0', 'Extérieur 172.16.3.0/24', '172.16.3.250'],
  ]),
  note('gray', 'ℹ️ Nommage des interfaces', '<p>Sur les <strong>routeurs 2811</strong> les interfaces sont des <code>FastEthernet0/x</code> ; sur un <strong>2911</strong> des <code>GigabitEthernet0/x</code>. Rôles identiques — adaptez simplement le nom dans la CLI.</p>'),
  note('gray', 'ℹ️ Noms de domaine utilisés', '<p>Le domaine des <strong>équipements réseau</strong> (<code>ip domain-name</code> des routeurs/switches, requis pour SSH) est <code>edivn.lan</code>. Les <strong>sites Web</strong> ont chacun leur <strong>zone DNS</strong> : <code>Groupe05-EDIVN.lan</code> (site public) et <code>05.EDIVN.lan</code> (intranet). Adaptez le numéro de groupe.</p>'),

  block('heading', { level: 2, text: '🖥️ Annexe 1 — configuration des machines virtuelles' }),
  block('html', { html: annexe1 }),
  note('gray', 'ℹ️ Remarques', '<p>Les deux VM (SRV-1 + CLIENT10) sont sur le <strong>même segment Admin</strong> et pointent vers le <strong>DNS 192.5.10.12</strong>, mais <strong>chacune sur son propre commutateur externe</strong> (2 cartes ou 2 hôtes — voir Étape 2). Masque <code>/28</code> = <code>255.255.255.240</code>, passerelle <code>192.5.10.14</code>.</p>'),

  pageBreak('Réalisation — déroulé'),
  block('heading', { level: 2, text: '🔧 Réalisation pas à pas' }),
  block('html', { html: '<p>Huit étapes, à suivre dans l’ordre. Chacune se termine par une <strong>vérification</strong> avant de passer à la suivante.</p>' }),

  // ── Étape 0 ──
  pageBreak('Étape 0 — Réinitialiser les équipements'),
  step('0', 'Réinitialiser les équipements réseau', 'Routeurs & switches — partir d’une configuration vierge', C.reset),
  railOpen(C.reset),
  note('blue', '🎯 Objectif', '<p>Partir d’une <strong>configuration vierge</strong> sur les routeurs et switches réutilisés (une ancienne config peut bloquer le TP). Ces équipements se configurent en <strong>ligne de commande (CLI)</strong> via le <strong>port console</strong> (câble console → port COM du PC), tant qu’ils n’ont pas d’adresse IP pour le SSH. On se connecte à la console, on efface la <strong>startup-config</strong>, puis on redémarre.</p>'),
  note('red', '🧨 À faire AVANT toute configuration sur du matériel réutilisé', '<p>Un équipement qui a déjà servi peut contenir une config qui <strong>bloque tout</strong> : routes par défaut erronées, ACL/NAT hors sujet, doublons d’adresses, VLAN parasites (fréquent sur du matériel de lab). On <strong>efface la configuration de démarrage</strong> et on <strong>redémarre</strong>.</p>'),

  block('heading', { level: 4, text: 'a) Se connecter au port console (avant tout réseau)' }),
  block('html', { html: '<p>Un équipement neuf ou réinitialisé n’a <strong>pas d’adresse IP</strong> → le SSH est impossible. On passe par le <strong>port CONSOLE</strong>, avec un <strong>câble console</strong> (rollover RJ45 → série, ou cordon <strong>USB console</strong>). Le PC voit alors un <strong>port COM</strong>.</p>' }),
  ul([
    'Brancher le câble : prise <strong>CONSOLE</strong> (bleu clair) de l’équipement → port <strong>série / USB</strong> du PC (adaptateur USB-série si nécessaire).',
    'Repérer le numéro de port : <strong>Gestionnaire de périphériques</strong> Windows → <em>Ports (COM et LPT)</em> → noter <code>COMx</code>.',
  ]),
  block('heading', { level: 4, text: 'b) Ouvrir la console dans MobaXterm' }),
  ul([
    'MobaXterm → bouton <strong>Session</strong> → <strong>Serial</strong>.',
    '<strong>Serial port</strong> = <code>COMx</code> (celui repéré), <strong>Speed (bps)</strong> = <code>9600</code>.',
    'Onglet <em>Advanced Serial settings</em> : <strong>Data bits</strong> = 8, <strong>Stop bits</strong> = 1, <strong>Parity</strong> = none, <strong>Flow control</strong> = none.',
    'Cliquer <strong>OK</strong> pour ouvrir la session, puis appuyer sur <strong>Entrée</strong> pour obtenir l’invite (<code>Router&gt;</code> ou <code>Switch&gt;</code>).',
  ]),
  note('gray', 'ℹ️ Paramètres série Cisco (9600 8N1)', '<p><strong>9600</strong> bauds · <strong>8</strong> bits de données · parité <strong>aucune</strong> · <strong>1</strong> bit de stop · <strong>pas</strong> de contrôle de flux. (Alternative <strong>PuTTY</strong> : <em>Connection type</em> = <strong>Serial</strong>, <em>Serial line</em> = <code>COMx</code>, <em>Speed</em> = <code>9600</code>.)</p>'),
  note('yellow', '🩹 Rien ne s’affiche ?', '<ul><li>Mauvais <strong>COMx</strong> ou <strong>vitesse</strong> ≠ 9600 → vérifier dans le Gestionnaire de périphériques et les réglages MobaXterm.</li><li>Pilote de l’adaptateur USB-série absent (Prolific / FTDI) → l’installer.</li><li>Appuyer plusieurs fois sur <strong>Entrée</strong> ; débrancher/rebrancher le câble console.</li></ul>'),

  block('heading', { level: 4, text: 'c) Effacer la configuration' }),
  block('html', { html: '<p>Une fois l’invite obtenue dans la console, on efface la configuration de démarrage :</p>' }),
  cmd(`enable
write erase          ! ou :  erase startup-config
reload
! "System configuration has been modified. Save? [yes/no]:"  -> no
! "Proceed with reload? [confirm]"                            -> Entree
! au redemarrage, refuser l'assistant de configuration :
! "...enter the initial configuration dialog? [yes/no]:"      -> no`),
  note('yellow', '💡 Bon à savoir', '<p><code>write erase</code> efface la <strong>startup-config</strong> (NVRAM) ; c’est le <code>reload</code> qui recharge une config vide. Sur un <strong>switch</strong>, supprimez aussi la base VLAN si des VLAN parasites subsistent : <code>delete flash:vlan.dat</code> (confirmer) <strong>avant</strong> le <code>reload</code>. Répondez <strong>no</strong> à l’enregistrement.</p>'),
  note('gray', '🔗 Détail', '<p>Pas-à-pas générique : <a href="/pages/procedure-cisco-routeur-cli">Configurer un routeur Cisco (CLI)</a>.</p>'),

  // ── Étape 1 ──
  railClose,
  pageBreak('Étape 1 — Routeur interne R_IT'),
  step('1', 'Routeur interne R_IT — interfaces & SSH', 'Adressage des 2 interfaces + accès de management SSH', C.routeur),
  railOpen(C.routeur),
  note('blue', '🎯 Objectif', '<p>Configurer le <strong>routeur interne R_IT_G5</strong> : adresser ses <strong>deux interfaces</strong> (côté Admin/IT et côté Utilisateurs — il assure le routage entre les deux réseaux), puis activer l’accès d’administration <strong>SSH</strong> (mot de passe <code>cisco</code>). Tout se fait depuis la <strong>console</strong>, le SSH n’étant pas encore actif. Saisissez les blocs de commandes ci-dessous.</p>'),
  block('html', { html: '<p>Configurer les <strong>deux interfaces</strong> du routeur interne (côté Admin/IT et côté Utilisateurs) puis l’<strong>accès SSH</strong> (mot de passe <code>cisco</code>). Tout se fait <strong>depuis la console</strong> (onglet <code>CLI</code> sous Packet Tracer, ou câble console sur matériel réel) — le SSH n’étant pas encore actif.</p>' }),
  cmd(`enable
configure terminal
hostname R_IT_G5
!
! --- Interfaces ---
interface GigabitEthernet0/0
 description Reseau Admin/IT
 ip address 192.5.10.14 255.255.255.240
 no shutdown
 exit
interface GigabitEthernet0/1
 description Reseau Utilisateurs
 ip address 192.5.50.254 255.255.255.0
 no shutdown
 exit
!
! --- Acces distant SSH (mot de passe : cisco) ---
ip domain-name edivn.lan
enable secret cisco
username admin privilege 15 secret cisco
crypto key generate rsa
1024
ip ssh version 2
line vty 0 4
 transport input ssh
 login local
 exit
!
end
write memory`),
  note('gray', 'ℹ️ Points clés', '<ul><li><code>Gi0/0</code> = passerelle du réseau <strong>Admin/IT</strong> (<code>192.5.10.14/28</code>), <code>Gi0/1</code> = passerelle du réseau <strong>Utilisateurs</strong> (<code>192.5.50.254/24</code>).</li><li>SSH exige un <strong>hostname</strong>, un <strong>ip domain-name</strong> et des <strong>clés RSA</strong> (le <code>1024</code> répond à la question de longueur de clé). <code>login local</code> utilise le compte <code>username</code>.</li></ul>'),
  block('html', { html: '<p><strong>Vérification :</strong></p>' }),
  cmd(`do show ip interface brief
! Gi0/0 -> 192.5.10.14  up/up  |  Gi0/1 -> 192.5.50.254  up/up
! puis, depuis un client : ssh -l admin 192.5.10.14`),
  note('gray', '🔗 Rappels', '<p><a href="/pages/procedure-cisco-routeur-cli">Configurer un routeur en CLI</a> · <a href="/pages/procedure-ssh-packet-tracer">SSH sur Packet Tracer</a>.</p>'),

  // ── Étape 2 ──
  railClose,
  pageBreak('Étape 2 — Machines virtuelles (Hyper-V)'),
  step('2', 'Machines virtuelles (Hyper-V)', 'Serveur SRV-1 + poste CLIENT10, un commutateur externe par VM', C.vm),
  railOpen(C.vm),
  note('blue', '🎯 Objectif', '<p>Créer les <strong>deux machines virtuelles</strong> du réseau d’administration sous <strong>Hyper-V</strong> : le serveur <strong>SRV-1</strong> (Windows Server 2019) et le poste <strong>CLIENT10</strong> (Windows 10 Pro), puis les <strong>renommer</strong> et leur affecter une <strong>adresse IP fixe</strong> (Annexe 1). Sur chaque écran, le champ à renseigner est <strong style="color:#e11d48">encadré en rouge</strong>.</p>'),
  note('gray', '📋 Prérequis', '<ul><li>Le rôle <strong>Hyper-V</strong> installé sur l’hôte.</li><li>Les images d’installation <strong>ISO</strong> de Windows Server 2019 et Windows 10 Pro.</li><li>Un <strong>commutateur virtuel Externe</strong> créé par machine (voir la règle ⚠️ en fin d’étape).</li></ul>'),

  tstep('2.1', 'Créer la VM (assistant Nouvel ordinateur virtuel)'),
  block('html', { html: '<p>Dans le <strong>Gestionnaire Hyper-V</strong>, volet <em>Actions</em> → <strong>Nouveau → Ordinateur virtuel</strong>. L’assistant se déroule sur <strong>plusieurs pages</strong> (l’exemple montre le serveur <strong>SRV-1</strong>). Touchez le bandeau ci-dessous pour dérouler les écrans :</p>' }),
  pager('🖥️ Assistant « Nouvel ordinateur virtuel »', [
  simWin(wizPage('🖥️', 'Nouvel ordinateur virtuel', VM_STEPS, 0, 'Avant de commencer',
    '<p style="margin:0">Cet Assistant vous aide à créer un ordinateur virtuel. Cliquez sur <strong>Suivant</strong> pour continuer, ou sur Terminer pour utiliser les valeurs par défaut.</p>'
    + `<label class="sw-radio" style="margin-top:12px">${rOFF} Ne plus afficher cette page</label>`, wizBtns()),
    '① Page « Avant de commencer » → cliquez sur Suivant.'),
  simWin(wizPage('🖥️', 'Nouvel ordinateur virtuel', VM_STEPS, 1, 'Spécifier le nom et l’emplacement',
    '<p style="margin:0 0 10px">Choisissez un nom et un emplacement pour cet ordinateur virtuel.</p>'
    + `<div class="sw-row"><span class="l">Nom :</span>${kbx(1, '<span class="sw-in" style="width:150px">SRV-1</span>')}</div>`
    + `<label class="sw-radio" style="margin-top:10px">${rOFF} Stocker l’ordinateur virtuel à un autre emplacement</label>`, wizBtns()),
    '② Page « Nom et emplacement ».',
    ['Saisissez le <strong>nom</strong> de la VM : <code>SRV-1</code> (ou <code>CLIENT10</code> pour le poste).']),
  simWin(wizPage('🖥️', 'Nouvel ordinateur virtuel', VM_STEPS, 2, 'Spécifier la génération',
    '<p style="margin:0 0 10px">Choisissez la génération de cet ordinateur virtuel.</p>'
    + `<label class="sw-radio">${rOFF} Génération 1</label>`
    + kbx(1, `<label class="sw-radio">${rON} Génération 2</label>`)
    + '<p class="meta" style="font-size:11px;margin:8px 0 0">La génération 2 prend en charge l’UEFI et le démarrage sécurisé.</p>', wizBtns()),
    '③ Page « Génération ».',
    ['Cochez <strong>Génération 2</strong> (UEFI) — adaptée à Windows Server 2019 / Windows 10.']),
  simWin(wizPage('🖥️', 'Nouvel ordinateur virtuel', VM_STEPS, 3, 'Affecter la mémoire',
    '<p style="margin:0 0 10px">Spécifiez la quantité de mémoire à allouer à cet ordinateur virtuel.</p>'
    + kbx(1, '<div class="sw-row"><span class="l">Mémoire de démarrage :</span><span class="sw-in" style="width:90px;text-align:right">4096</span> Mo</div>')
    + `<label class="sw-radio" style="margin-top:8px">${rOFF} Utiliser la mémoire dynamique</label>`, wizBtns()),
    '④ Page « Affecter la mémoire ».',
    ['Mémoire de démarrage = <strong>4096</strong> Mo (4 Go).']),
  simWin(wizPage('🖥️', 'Nouvel ordinateur virtuel', VM_STEPS, 4, 'Configurer la mise en réseau',
    '<p style="margin:0 0 10px">Chaque nouvel ordinateur virtuel comprend une carte réseau.</p>'
    + `<div class="sw-row"><span class="l">Connexion :</span>${kbx(1, '<span class="sw-sel">COMM-VIRTUEL-EXT-client</span>')}</div>`, wizBtns()),
    '⑤ Page « Mise en réseau ».',
    ['Choisissez le <strong>commutateur virtuel Externe</strong> dédié à cette machine.']),
  simWin(wizPage('🖥️', 'Nouvel ordinateur virtuel', VM_STEPS, 5, 'Connecter un disque dur virtuel',
    '<p style="margin:0 0 10px">Créez un disque dur virtuel pour installer le système d’exploitation.</p>'
    + kbx(1, `<label class="sw-radio">${rON} Créer un disque dur virtuel</label>`
      + '<div class="sw-row" style="margin-left:22px"><span class="l">Nom :</span><span class="sw-in" style="width:130px">SRV-1.vhdx</span></div>'
      + '<div class="sw-row" style="margin-left:22px"><span class="l">Taille :</span><span class="sw-in" style="width:60px;text-align:right">50</span> Go</div>'), wizBtns()),
    '⑥ Page « Disque dur virtuel ».',
    ['Taille du disque : <strong>50 Go</strong> pour le serveur (<strong>40 Go</strong> pour CLIENT10).']),
  simWin(wizPage('🖥️', 'Nouvel ordinateur virtuel', VM_STEPS, 6, 'Options d’installation',
    '<p style="margin:0 0 8px">Vous pouvez installer un système d’exploitation maintenant.</p>'
    + `<label class="sw-radio">${rOFF} Installer un système d’exploitation plus tard</label>`
    + kbx(1, `<label class="sw-radio">${rON} Installer à partir d’un fichier image de démarrage (.iso)</label>`
      + '<div class="sw-row" style="margin-left:22px"><span class="l">Fichier image :</span><span class="sw-in" style="width:200px">D:\\ISO\\WinServer2019.iso</span></div>'), wizBtns()),
    '⑦ Page « Options d’installation ».',
    ['Sélectionnez l’<strong>ISO</strong> de Windows (Server 2019 pour SRV-1, Windows 10 pour CLIENT10).']),
  simWin(wizPage('🖥️', 'Nouvel ordinateur virtuel', VM_STEPS, 7, 'Résumé',
    '<p style="margin:0 0 8px">Vous avez terminé l’Assistant Nouvel ordinateur virtuel. Configuration :</p>'
    + '<div style="font-size:12px;color:#333;line-height:1.8;border:1px solid #ddd;border-radius:4px;padding:8px 10px">Nom : <b>SRV-1</b><br>Génération : 2<br>Mémoire : 4096 Mo<br>Réseau : COMM-VIRTUEL-EXT-client<br>Disque : SRV-1.vhdx (50 Go)</div>', wizBtns(true)),
    '⑧ Page « Résumé » → cliquez sur Terminer. Répétez l’assistant pour la 2ᵉ VM (CLIENT10).'),
  ]),
  block('html', { html: tbl(['La machine', 'Nom à donner', 'Système à installer', 'Mémoire'], [
    ['Le serveur', '<strong>SRV-1</strong>', 'Windows Server 2019', '4096 Mo'],
    ['Le poste', '<strong>CLIENT10</strong>', 'Windows 10 Pro', '4096 Mo'],
  ]) }),

  tstep('2.2', 'Brancher la carte réseau au bon « commutateur »'),
  block('html', { html: '<p>Reliez la <strong>carte réseau</strong> de la VM à un <strong>commutateur virtuel</strong>. Faites un <strong>clic droit sur la VM → Paramètres</strong>, sélectionnez <strong>Carte réseau</strong> dans la colonne de gauche, puis dans la liste <strong>Commutateur virtuel</strong> choisissez le commutateur <strong>Externe</strong> dédié à cette machine :</p>' }),
  simWin(
    swFrame('🖧', 'Paramètres pour CLIENT10 — Carte réseau',
      '<p style="margin:0 0 6px;font-weight:600">Carte réseau</p><p style="margin:0 0 12px;color:#444">Spécifiez la configuration de la carte réseau ou retirez-la.</p>'
      + `<div class="sw-row"><span class="l">Commutateur virtuel :</span>${kbx(1, '<span class="sw-sel">COMM-VIRTUEL-EXT-client</span>')}</div>`),
    'Clic droit sur la machine → « Paramètres » → rubrique « Carte réseau ».',
    ['Dans la liste <strong>« Commutateur virtuel »</strong>, choisissez un commutateur <strong>Externe</strong> (un par machine — voir la règle ⚠️ ci-dessous).']),

  tstep('2.3', 'Renommer la machine'),
  block('html', { html: '<p>On donne à chaque machine un <strong>nom clair</strong> (<code>SRV-1</code>, <code>CLIENT10</code>). Chemin : <strong>clic droit sur « Ce PC » → Propriétés</strong> → dans « Propriétés système », onglet <strong>Nom de l’ordinateur</strong> → bouton <strong>Modifier…</strong>. La fenêtre suivante s’ouvre :</p>' }),
  simWin(
    swFrame('💻', 'Modification du nom ou du domaine de l’ordinateur',
      '<p style="margin:0 0 12px">Vous pouvez modifier le nom et l’appartenance de cet ordinateur.</p>'
      + `<div class="sw-row"><span class="l">Nom de l’ordinateur :</span>${kbx(1, '<span class="sw-in" style="width:160px">CLIENT10</span>')}</div>`
      + '<div class="sw-fs"><span class="lg">Membre d’un</span>'
      + `<label class="sw-radio">${rOFF} Domaine :</label><div class="sw-row" style="margin-left:22px"><span class="sw-in" style="width:160px;color:#aaa">&nbsp;</span></div>`
      + `<label class="sw-radio" style="margin-top:4px">${rON} Groupe de travail :</label><div class="sw-row" style="margin-left:22px"><span class="sw-in" style="width:160px">WORKGROUP</span></div>`
      + '</div>'),
    'Propriétés système → onglet « Nom de l’ordinateur » → bouton « Modifier… ».',
    ['Tapez le <strong>nouveau nom</strong> (ici <code>CLIENT10</code> ; mettez <code>SRV-1</code> pour le serveur), cliquez <strong>OK</strong>, puis <strong>redémarrez</strong>.',
      'On reste en <strong>Groupe de travail</strong> (le domaine viendra plus tard, une fois Active Directory installé).']),

  tstep('2.4', 'Donner l’adresse IP fixe'),
  block('html', { html: '<p>Attribuez l’<strong>adresse IP fixe</strong>. Ouvrez le <strong>Centre Réseau et partage</strong> → <em>Modifier les paramètres de la carte</em> → clic droit sur <strong>Ethernet → Propriétés</strong> → double-clic sur <strong>Protocole Internet version 4 (TCP/IPv4)</strong>. Renseignez la configuration selon l’Annexe 1 :</p>' }),
  simWin(
    swFrame('🌐', 'Propriétés de : Protocole Internet version 4 (TCP/IPv4)',
      `<label class="sw-radio">${rOFF} Obtenir une adresse IP automatiquement</label>`
      + kbx(1, `<label class="sw-radio">${rON} Utiliser l’adresse IP suivante :</label>`
        + `<div class="sw-row" style="margin-left:22px"><span class="l">Adresse IP :</span>${swIp('192.5.10.1')}</div>`
        + `<div class="sw-row" style="margin-left:22px"><span class="l">Masque de sous-réseau :</span>${swIp('255.255.255.240')}</div>`
        + `<div class="sw-row" style="margin-left:22px"><span class="l">Passerelle par défaut :</span>${swIp('192.5.10.14')}</div>`)
      + `<label class="sw-radio" style="margin-top:10px">${rOFF} Obtenir les adresses des serveurs DNS automatiquement</label>`
      + kbx(2, `<label class="sw-radio">${rON} Utiliser l’adresse de serveur DNS suivante :</label>`
        + `<div class="sw-row" style="margin-left:22px"><span class="l">Serveur DNS préféré :</span>${swIp('192.5.10.12')}</div>`)),
    'Fenêtre « Protocole Internet version 4 (TCP/IPv4) » — exemple du poste CLIENT10.',
    ['Cochez <strong>« Utiliser l’adresse IP suivante »</strong>, puis saisissez l’<strong>adresse IP</strong>, le <strong>masque</strong> et la <strong>passerelle par défaut</strong>.',
      'Cochez <strong>« Utiliser l’adresse de serveur DNS suivante »</strong> et indiquez le <strong>serveur DNS</strong> : <code>192.5.10.12</code>.']),
  block('html', { html: tbl(['La machine', 'Adresse IP', 'Masque', 'Passerelle', 'Serveur DNS'], [
    ['<strong>SRV-1</strong> (serveur)', '192.5.10.12', '255.255.255.240', '192.5.10.14', '192.5.10.12'],
    ['<strong>CLIENT10</strong> (poste)', '192.5.10.1', '255.255.255.240', '192.5.10.14', '192.5.10.12'],
  ]) }),
  note('yellow', '✅ Vérifier que ça marche', '<p>Ouvrez l’<strong>invite de commandes</strong> (touche Windows, tapez <code>cmd</code>, Entrée) et tapez <code>ipconfig</code> : vous devez voir l’adresse que vous venez de saisir. Puis <code>ping 192.5.10.14</code> (la passerelle) — si ça répond, la machine est bien branchée au réseau.</p>'),
  note('blue', '🧩 Rôles du serveur', '<p>Le serveur <strong>SRV-1</strong> (Windows Server 2019, <code>192.5.10.12</code>) porte les rôles <strong>DHCP</strong>, <strong>DNS</strong> et <strong>Serveur Web (IIS)</strong>, installés aux étapes 5 et 6. <strong>CLIENT10</strong> est un simple poste <strong>Windows 10 Pro</strong>.</p>'),
  note('red', '⚠️ Règle : un commutateur externe distinct par VM', '<p>Un commutateur virtuel <strong>Externe</strong> est lié à <strong>une seule carte réseau physique</strong>. Sur le matériel du lab, faire passer les deux VM par le <strong>même</strong> commutateur externe provoque des problèmes de connectivité (pont / multi-homing). La règle est donc : <strong>chaque VM sur son propre commutateur externe</strong>, ce qui impose</p><ul><li>soit <strong>2 cartes réseau physiques distinctes</strong> sur le même hôte (un commutateur externe par carte),</li><li>soit <strong>2 hôtes Hyper-V différents</strong>, une VM par hôte.</li></ul><p>Les deux VM restent sur le <strong>même segment Admin</strong> (<code>192.5.10.0/28</code>) — c’est le <strong>lien physique</strong> qui est dédoublé, pas le sous-réseau. Vérifiez que chaque commutateur externe pointe sur la <strong>bonne carte</strong> (cf. <em>Pièges fréquents ①</em> et <em>④</em>).</p>'),
  note('gray', '🔗 Détails', '<p><a href="/pages/procedure-vm-hyperv">Créer & configurer une VM (ISO) sur Hyper-V</a> · <a href="/pages/procedure-hyperv-ressources">Hyper-V : ressources</a> · <a href="/pages/procedure-ip-fixe-windows">Configurer une IP fixe</a> · <a href="/pages/procedure-renommer-poste">Renommer un poste</a>.</p>'),

  // ── Étape 3 ──
  railClose,
  pageBreak('Étape 3 — Switches (SSH)'),
  step('3', 'Switches — renommage, gestion & SSH', 'IP de gestion (SVI VLAN 1) + accès SSH sur SW-1 et Sw-2', C.switch),
  railOpen(C.switch),
  note('blue', '🎯 Objectif', '<p>Renommer les deux switches, leur attribuer une <strong>IP de gestion</strong> (interface virtuelle <strong>SVI VLAN 1</strong>, pour l’administration à distance) et activer <strong>SSH</strong> (mot de passe <code>cisco</code>). Les commandes sont identiques pour SW-1 et Sw-2 : seuls le nom, l’IP de gestion et la passerelle changent.</p>'),
  block('html', { html: '<p><strong>Renommer</strong> les deux switches, leur attribuer une <strong>IP de gestion</strong> (SVI <code>VLAN 1</code>) et activer <strong>SSH</strong> (mot de passe <code>cisco</code>). Configuration depuis la console.</p>' }),
  cmd(`enable
configure terminal
hostname SW-1
ip domain-name edivn.lan
enable secret cisco
username admin privilege 15 secret cisco
!
! --- IP de gestion (SVI) ---
interface vlan 1
 ip address 192.5.10.13 255.255.255.240
 no shutdown
 exit
ip default-gateway 192.5.10.14
!
! --- SSH ---
crypto key generate rsa
1024
ip ssh version 2
line vty 0 4
 transport input ssh
 login local
 exit
!
end
write memory`),
  block('html', { html: '<p>Mêmes commandes pour <strong>Sw-2</strong> en adaptant le nom, l’IP de gestion et la passerelle :</p>' }),
  block('html', { html: tbl(['Switch', 'Réseau', 'IP de gestion (VLAN 1)', 'Masque', 'ip default-gateway'], [
    ['SW-1', 'Admin / IT', '192.5.10.13', '255.255.255.240', '192.5.10.14'],
    ['Sw-2', 'Utilisateurs', '192.5.50.253', '255.255.255.0', '192.5.50.254'],
  ]) }),
  note('gray', 'ℹ️ IP de gestion', '<p>Un switch de niveau 2 n’a pas d’IP sur ses ports ; on lui donne une <strong>adresse de gestion sur le SVI VLAN 1</strong> (dans le sous-réseau de son segment) + une <code>ip default-gateway</code> pour être joignable en SSH depuis un autre réseau.</p>'),

  // ── Étape 4 ──
  railClose,
  pageBreak('Étape 4 — Câblage & tests ping'),
  step('4', 'Câblage & vérifications physiques', 'Interconnexion des équipements et contrôle des liens', C.cable),
  railOpen(C.cable),
  ul([
    '<strong>SW-1</strong> (Admin/IT) : Poste Admin 1 et Serveur en <strong>ports access</strong> ; liaison montante vers <strong>R_IT_G5 Gi0/0</strong>.',
    '<strong>Sw-2</strong> (Utilisateurs) : Stagiaire, Formateur et le <strong>WAP 371</strong> en ports access ; liaisons vers <strong>R_IT_G5 Gi0/1</strong> et <strong>Routeur_G5</strong>.',
    '<strong>Routeur_G5</strong> : côté Utilisateurs (Sw-2) et côté extérieur (<code>172.16.3.0/24</code>) vers les autres écoles.',
  ]),
  note('yellow', '🔍 Vérifications', '<ul><li><code>show ip interface brief</code> sur chaque switch → <strong>Vlan1 up/up</strong>.</li><li>Voyants des ports au <strong>vert</strong> une fois tout branché.</li><li>Depuis le poste admin : <code>ssh -l admin 192.5.10.13</code> (SW-1) et un <code>ping</code> vers la passerelle.</li></ul>'),

  block('heading', { level: 3, text: '🔌 Plan de tests ping (communication réseau)' }),
  note('blue', '🎯 Méthode : tester en anneaux', '<p>Une fois le câblage terminé, on valide la connectivité du <strong>plus proche au plus lointain</strong> : d’abord sa <strong>passerelle</strong>, puis le <strong>réseau distant</strong>, puis la <strong>sortie</strong>, puis <strong>Internet</strong>. La <strong>première</strong> étape qui échoue localise la panne au saut près. Les <strong>interfaces de routeur</strong> répondent toujours → idéales pour valider le <strong>routage</strong> sans interférence du pare-feu.</p>'),
  note('gray', '🕐 Quand chaque anneau devient testable', '<ul><li><strong>A (local)</strong> : dès le câblage — passerelles, switches, serveur en IP fixe.</li><li><strong>B (inter-réseaux)</strong> : les interfaces de routeur dès l’étape 1 ; les <strong>postes Utilisateurs</strong> une fois le <strong>DHCP</strong> en service (étape 6).</li><li><strong>C (salle / Internet)</strong> : après le <strong>routage + NAT</strong> (étape 7).</li></ul>'),

  block('heading', { level: 4, text: 'A. Dans chaque réseau (liaison locale)' }),
  block('html', { html: '<p><strong>Depuis le Poste Admin</strong> (<code>192.5.10.1</code>, réseau Admin) :</p>' }),
  block('html', { html: tbl(['Commande', 'Cible', 'Ce que ça valide'], [
    ['<code>ping 192.5.10.14</code>', 'passerelle Admin (R_IT_G5 Gi0/0)', 'lien local + switch SW-1'],
    ['<code>ping 192.5.10.13</code>', 'SW-1 (IP de gestion)', 'switch joignable'],
    ['<code>ping 192.5.10.12</code>', 'SRV-1 (serveur) ✱', 'le serveur répond'],
  ]) }),
  block('html', { html: '<p><strong>Depuis un poste Utilisateurs</strong> (<code>192.5.50.x</code>) :</p>' }),
  block('html', { html: tbl(['Commande', 'Cible', 'Ce que ça valide'], [
    ['<code>ping 192.5.50.254</code>', 'passerelle Users (R_IT_G5 Gi0/1)', 'lien local + switch Sw-2'],
    ['<code>ping 192.5.50.253</code>', 'Sw-2 (IP de gestion)', 'switch joignable'],
    ['<code>ping 192.5.50.252</code>', 'Routeur_G5 (LAN)', 'routeur de bordure joignable'],
    ['<code>ping 192.5.50.251</code>', 'WAP 371', 'point d’accès joignable'],
    ['<code>ping &lt;IP Formateur&gt;</code>', 'autre poste du réseau ✱', 'communication entre postes'],
  ]) }),

  block('heading', { level: 4, text: 'B. Entre les réseaux (routage via R_IT_G5)' }),
  block('html', { html: tbl(['Depuis', 'Commande', 'Ce que ça valide'], [
    ['Poste Users', '<code>ping 192.5.10.14</code>', 'routage Users → Admin (interface routeur, répond toujours)'],
    ['Poste Users', '<code>ping 192.5.10.12</code> ✱', 'le serveur Admin est joignable depuis Users'],
    ['Poste Admin', '<code>ping 192.5.50.254</code>', 'routage Admin → Users (interface routeur)'],
    ['Poste Admin', '<code>ping 192.5.50.251</code>', 'le WAP est joignable depuis Admin'],
  ]) }),
  note('yellow', '✱ Ping vers une machine Windows', '<p>Les cibles marquées <strong>✱</strong> sont des <strong>postes/serveurs Windows</strong> : leur <strong>pare-feu</strong> peut bloquer le ping entrant <strong>même si le routage est bon</strong>. Si <code>ping .10.14</code> passe mais <code>ping .10.12</code> échoue → ce n’est pas le routage, c’est le pare-feu du serveur (voir <em>dépannage ③</em>). Autorisez l’ICMP entrant, ou fiez-vous à l’interface du routeur pour juger le routage.</p>'),

  block('heading', { level: 4, text: 'C. Vers la salle & Internet (via Routeur_G5)' }),
  block('html', { html: '<p><strong>Depuis un client du LAN</strong> :</p>' }),
  block('html', { html: tbl(['Commande', 'Cible', 'Ce que ça valide'], [
    ['<code>ping 172.16.3.250</code>', 'Routeur_G5 (WAN)', 'routage jusqu’au routeur de bordure'],
    ['<code>ping 172.16.3.254</code>', 'passerelle de la salle', 'sortie vers le réseau de la salle'],
    ['<code>ping 8.8.8.8</code>', 'Internet', 'accès Internet (via NAT/PAT)'],
  ]) }),

  block('heading', { level: 4, text: 'D. Depuis les routeurs (pour isoler une panne)' }),
  block('html', { html: tbl(['Sur', 'Commande', 'Ce que ça valide'], [
    ['R_IT_G5', '<code>ping 192.5.10.12</code> · <code>ping 192.5.50.252</code>', 'joint le serveur et le routeur de bordure'],
    ['R_IT_G5', '<code>ping 172.16.3.254</code>', 'la route par défaut vers Routeur_G5 fonctionne'],
    ['Routeur_G5', '<code>ping 192.5.50.254</code> · <code>ping 8.8.8.8</code>', 'joint R_IT_G5 et Internet'],
  ]) }),
  note('gray', '🧭 Si un test échoue', '<p>Déroulez les anneaux dans l’ordre A → B → C. Le premier échec situe la coupure : câble/switch (A), routage ou pare-feu (B), NAT/route par défaut (C). Détails dans les <strong>Pièges fréquents</strong> (bas de page) et la <a href="/pages/procedure-test-connectivite">méthode de test de connectivité</a>.</p>'),

  // ── Étape 5 ──
  railClose,
  pageBreak('Étape 5 — Serveur : rôles, IIS, DNS'),
  step('5', 'Serveur — rôles (DHCP · DNS · IIS) & sites Web', 'Installation des rôles DHCP/DNS/IIS, 2 sites Web et enregistrements DNS', C.serveur),
  railOpen(C.serveur),
  note('blue', '🎯 Objectif', '<p>Le serveur <strong>SRV-1</strong> (<code>192.5.10.12</code>) va rendre <strong>trois services</strong> : distribuer les adresses (<strong>DHCP</strong>), traduire les noms en adresses (<strong>DNS</strong>) et héberger les <strong>sites web</strong> (<strong>IIS</strong>). On installe d’abord ces « rôles », puis on crée les 2 sites et les noms DNS.</p>'),

  tstep('5.1', 'Installer les rôles (DHCP, DNS, IIS)'),
  block('html', { html: '<p>Dans le <strong>Gestionnaire de serveur</strong> → <strong>Gérer → Ajouter des rôles et fonctionnalités</strong>. Déroulez l’assistant jusqu’à la page <strong>« Rôles de serveurs »</strong> et cochez les rôles :</p>' }),
  simWin(
    swFrame('🧩', 'Assistant Ajouter des rôles — Rôles de serveurs',
      '<p style="margin:0 0 10px">Sélectionnez un ou plusieurs rôles à installer sur le serveur.</p>'
      + kbx(1, `<label class="sw-radio" style="margin:5px 0">${cON} Serveur DHCP</label><label class="sw-radio" style="margin:5px 0">${cON} Serveur DNS</label><label class="sw-radio" style="margin:5px 0">${cON} Serveur Web (IIS)</label>`)
      + `<label class="sw-radio" style="margin:5px 0">${cOFF} Services AD DS (Active Directory)</label>`,
      '<span class="sw-btn">&lt; Précédent</span><span class="sw-btn def">Suivant &gt;</span><span class="sw-btn">Installer</span>'),
    'Assistant « Ajouter des rôles » → page « Rôles de serveurs ».',
    ['Cochez <strong>Serveur DHCP</strong>, <strong>Serveur DNS</strong> et <strong>Serveur Web (IIS)</strong>, puis terminez avec <strong>Installer</strong>.']),

  tstep('5.2', 'Créer les 2 sites web (IIS)'),
  block('html', { html: '<p>Ouvrez le <strong>Gestionnaire des services Internet (IIS)</strong> → clic droit sur <strong>Sites → Ajouter un site Web…</strong>. Chaque site a son <strong>dossier</strong> (avec un <code>index.html</code>) et sa <strong>liaison</strong> (adresse + port + nom du site). Voici le site <strong>Public</strong> :</p>' }),
  simWin(
    swFrame('🕸️', 'Ajouter un site Web',
      '<div class="sw-row"><span class="l">Nom du site :</span><span class="sw-in" style="width:150px">Public-EDIVN</span></div>'
      + '<div class="sw-row"><span class="l">Chemin d’accès physique :</span><span class="sw-in" style="width:180px">C:\\inetpub\\Public-EDIVN</span></div>'
      + '<div class="sw-fs"><span class="lg">Liaison</span>'
      + '<div class="sw-row"><span class="l">Type :</span><span class="sw-in" style="width:70px;background:#eef1f4;color:#666">http</span><span class="l" style="flex:0 0 auto">Adresse IP :</span><span class="sw-in" style="width:120px;background:#eef1f4;color:#666">192.5.10.12</span></div>'
      + `<div class="sw-row"><span class="l">Port :</span>${kbx(1, '<span class="sw-in" style="width:64px">8080</span>')}<span class="l" style="flex:0 0 auto">Nom d’hôte :</span>${kbx(2, '<span class="sw-in" style="width:190px">www.Groupe05-EDIVN.lan</span>')}</div>`
      + '</div>'),
    'IIS → clic droit sur « Sites » → « Ajouter un site Web… » (exemple du site Public).',
    ['Le <strong>port 8080</strong> (imposé par le cahier des charges) — on l’écrira dans l’URL : <code>…:8080</code>.',
      'Le <strong>nom d’hôte</strong> du site : <code>www.Groupe05-EDIVN.lan</code>. L’intranet se fait pareil, avec <code>Intranet.05.EDIVN.lan</code>.']),
  block('html', { html: tbl(['Site', 'Dossier', 'Nom d’hôte (liaison)', 'Port', 'Page d’accueil'], [
    ['<strong>Public</strong>', 'C:\\inetpub\\Public-EDIVN', 'www.Groupe05-EDIVN.lan', '<strong>8080</strong>', '« Bienvenue sur le site de l’EDIVN »'],
    ['<strong>intranet</strong>', 'C:\\inetpub\\Prive-EDIVN', 'Intranet.05.EDIVN.lan', '80', '« Bienvenue sur l’intranet de l’école EDIVN »'],
  ]) }),

  tstep('5.3', 'Créer les noms DNS (le serveur traduit les noms en adresses)'),
  block('html', { html: '<p>Pour que <code>www.Groupe05-EDIVN.lan</code> mène au serveur, le <strong>DNS</strong> doit connaître ce nom. Ouvrez le <strong>Gestionnaire DNS</strong>, créez une <strong>zone de recherche directe</strong> par site, puis un <strong>enregistrement « Nouvel hôte (A) »</strong> pointant vers <code>192.5.10.12</code> :</p>' }),
  simWin(
    swFrame('🌐', 'Nouvel hôte (A)',
      '<div class="sw-row"><span class="l">Nom (parent si vide) :</span><span class="sw-in" style="width:120px">www</span></div>'
      + '<div class="sw-row"><span class="l">Nom de domaine complet :</span><span style="font-family:ui-monospace,monospace">www.Groupe05-EDIVN.lan</span></div>'
      + `<div class="sw-row"><span class="l">Adresse IP :</span>${kbx(1, swIp('192.5.10.12'))}</div>`
      + `<label class="sw-radio" style="margin-top:8px">${cON} Créer un pointeur PTR associé</label>`,
      '<span class="sw-btn def">Ajouter l’hôte</span><span class="sw-btn">Annuler</span>'),
    'Gestionnaire DNS → clic droit sur la zone → « Nouvel hôte (A)… ».',
    ['L’<strong>adresse IP</strong> du serveur : <code>192.5.10.12</code> (tous les noms de sites pointent vers lui).']),
  block('html', { html: tbl(['Zone à créer', 'Enregistrements', 'Le nom qui marchera'], [
    ['<code>Groupe05-EDIVN.lan</code>', 'A racine → 192.5.10.12 · alias <strong>CNAME</strong> <code>www</code>', '<code>www.Groupe05-EDIVN.lan</code> (site Public)'],
    ['<code>05.EDIVN.lan</code>', 'A racine → 192.5.10.12 · alias <strong>CNAME</strong> <code>Intranet</code>', '<code>Intranet.05.EDIVN.lan</code> (intranet)'],
  ]) }),
  note('blue', '🌐 Accès au site sur le port 8080', '<p>Le site est <strong>servi par IIS sur le port 8080</strong> (défini dans la <strong>liaison / binding</strong>). On y accède par <code>http://www.Groupe05-EDIVN.lan:8080</code> : le <strong>DNS</strong> résout le nom vers <code>192.5.10.12</code>, et le <code>:8080</code> correspond à la liaison IIS. <strong>Rappel</strong> : un enregistrement DNS (A/CNAME) ne transporte <strong>pas</strong> de port — c’est la <strong>liaison IIS</strong> qui fixe le 8080. Pour l’<strong>accès externe</strong>, prévoir une <strong>redirection de port (NAT/PAT)</strong> vers <code>192.5.10.12:8080</code> (étape 7).</p>'),
  note('gray', 'ℹ️ Pourquoi le port 8080 ?', '<p><strong>Port 80</strong> : port <strong>standard</strong> du trafic web grand public. <strong>Port 8080</strong> : alternative courante, utilisée pour <strong>séparer</strong> les accès web et <strong>renforcer la sécurité</strong> globale. Ici le site public est publié sur <code>8080</code> (exigence du cahier des charges) → il faut préciser <code>:8080</code> dans l’URL, sauf à ajouter une redirection <code>80 → 8080</code> (étape 7).</p>'),
  note('yellow', '🛡️ Pare-feu Windows du serveur', '<p>Ouvrir les <strong>flux entrants</strong> nécessaires dans le pare-feu (mode avancé, règles de trafic entrant) : <strong>HTTP</strong> (ports <code>80</code>/<code>8080</code>) pour servir les sites, et l’<strong>ICMP entrant</strong> pour répondre aux pings de test (cf. <em>Pièges fréquents ③</em>). Sans ces règles, le site ou les tests échouent alors que la configuration réseau est correcte.</p>'),
  note('gray', '🔗 Détails', '<p><a href="/pages/procedure-iis">IIS : héberger un site</a> · <a href="/pages/procedure-dns">DNS : zones & enregistrements</a> · <a href="/pages/procedure-dhcp">rôle DHCP</a>.</p>'),

  // ── Étape 6 ──
  railClose,
  pageBreak('Étape 6 — DHCP'),
  step('6', 'DHCP — étendues & relais', 'Deux étendues + relais ip helper-address sur le routeur', C.dhcp),
  railOpen(C.dhcp),
  note('blue', '🎯 Objectif', '<p>Le <strong>DHCP</strong> distribue <strong>automatiquement</strong> une adresse (avec la passerelle et le DNS) à chaque poste qui se connecte — plus besoin de la saisir à la main. On crée <strong>deux étendues</strong> (une par réseau) sur SRV-1, puis un <strong>relais</strong> sur le routeur pour que les postes Utilisateurs (de l’autre côté du routeur) soient servis aussi.</p>'),

  tstep('6.1', 'Créer une étendue (assistant Nouvelle étendue)'),
  block('html', { html: '<p>Dans la console <strong>DHCP</strong> → clic droit sur <strong>IPv4 → Nouvelle étendue…</strong>. L’assistant se déroule page par page (exemple : l’<strong>étendue Stagiaires</strong>). Touchez le bandeau pour dérouler les écrans :</p>' }),
  pager('📶 Assistant « Nouvelle étendue » DHCP', [
  simWin(wizPage('📶', 'Assistant Nouvelle étendue', DHCP_STEPS, 0, 'Nom de l’étendue',
    '<p style="margin:0 0 10px">Donnez un nom et une description à cette étendue.</p>'
    + `<div class="sw-row"><span class="l">Nom :</span>${kbx(1, '<span class="sw-in" style="width:170px">Etendue Stagiaires</span>')}</div>`, wizBtns()),
    '① Page « Nom de l’étendue ».', ['Nommez l’étendue (ex. <code>Etendue Stagiaires</code>).']),
  simWin(wizPage('📶', 'Assistant Nouvelle étendue', DHCP_STEPS, 1, 'Plage d’adresses IP',
    '<p style="margin:0 0 10px">Définissez la plage d’adresses distribuée par cette étendue.</p>'
    + kbx(1, `<div class="sw-row"><span class="l">Adresse IP de début :</span>${swIp('192.5.50.1')}</div>`
      + `<div class="sw-row"><span class="l">Adresse IP de fin :</span>${swIp('192.5.50.200')}</div>`)
    + `<div class="sw-row"><span class="l">Masque de sous-réseau :</span>${swIp('255.255.255.0')}</div>`, wizBtns()),
    '② Page « Plage d’adresses IP ».', ['La <strong>plage distribuée</strong> : <code>.1</code> → <code>.200</code>, avec le masque du réseau.']),
  simWin(wizPage('📶', 'Assistant Nouvelle étendue', DHCP_STEPS, 2, 'Ajout d’exclusions et de retard',
    '<p style="margin:0">Aucune exclusion ici (les IP fixes de l’infra sont <em>au-dessus</em> du pool). Cliquez sur <strong>Suivant</strong>.</p>', wizBtns()),
    '③ Page « Exclusions » → Suivant (rien à exclure).'),
  simWin(wizPage('📶', 'Assistant Nouvelle étendue', DHCP_STEPS, 3, 'Durée du bail',
    '<p style="margin:0 0 10px">Durée pendant laquelle un client conserve son adresse.</p>'
    + '<div class="sw-row"><span class="l">Limitée à :</span><span class="sw-in" style="width:50px;text-align:right">8</span> jours</div>', wizBtns()),
    '④ Page « Durée du bail » (8 jours par défaut).'),
  simWin(wizPage('📶', 'Assistant Nouvelle étendue', DHCP_STEPS, 4, 'Configurer les options DHCP',
    '<p style="margin:0 0 10px">Voulez-vous configurer les options (passerelle, DNS…) maintenant ?</p>'
    + kbx(1, `<label class="sw-radio">${rON} Oui, je veux configurer ces options maintenant</label>`)
    + `<label class="sw-radio">${rOFF} Non, je les configurerai plus tard</label>`, wizBtns()),
    '⑤ Page « Configurer les options » → cochez <strong>Oui</strong>.', ['Répondez <strong>Oui</strong> pour enchaîner sur les options 003 et 006.']),
  simWin(wizPage('📶', 'Assistant Nouvelle étendue', DHCP_STEPS, 5, 'Routeur (passerelle par défaut)',
    '<p style="margin:0 0 10px">Adresse du routeur (option <strong>003</strong>) distribuée aux clients.</p>'
    + `<div class="sw-row"><span class="l">Adresse IP :</span>${kbx(1, swIp('192.5.50.254'))}</div><div class="sw-row"><span class="sw-btn">Ajouter</span></div>`, wizBtns()),
    '⑥ Page « Routeur » = option <strong>003</strong>.', ['La <strong>passerelle</strong> du réseau Utilisateurs : <code>192.5.50.254</code>.']),
  simWin(wizPage('📶', 'Assistant Nouvelle étendue', DHCP_STEPS, 6, 'Nom de domaine et serveurs DNS',
    '<p style="margin:0 0 10px">Serveur DNS (option <strong>006</strong>) distribué aux clients.</p>'
    + '<div class="sw-row"><span class="l">Domaine parent :</span><span class="sw-in" style="width:150px">edivn.lan</span></div>'
    + `<div class="sw-row"><span class="l">Serveur DNS :</span>${kbx(1, swIp('192.5.10.12'))}</div>`, wizBtns()),
    '⑦ Page « Serveurs DNS » = option <strong>006</strong>.', ['Le <strong>serveur DNS</strong> : <code>192.5.10.12</code> (SRV-1).']),
  simWin(wizPage('📶', 'Assistant Nouvelle étendue', DHCP_STEPS, 8, 'Activer l’étendue',
    `<label class="sw-radio">${kbx(1, `${rON} Oui, je veux activer cette étendue maintenant`)}</label>`
    + `<label class="sw-radio" style="margin-top:6px">${rOFF} Non, je l’activerai plus tard</label>`, wizBtns(true)),
    '⑧ Page « Activer l’étendue » → <strong>Oui</strong>, puis Terminer. (La page « Serveurs WINS » se passe avec Suivant.)',
    ['Sans <strong>activation</strong>, l’étendue ne distribue rien.']),
  ]),
  block('html', { html: tbl(['Étendue', 'Réseau', 'Plage', '003 Passerelle', '006 DNS'], [
    ['<strong>Admins</strong>', '192.5.10.0/28', '.1 → .11', '192.5.10.14', '192.5.10.12'],
    ['<strong>Stagiaires</strong>', '192.5.50.0/24', '.1 → .200', '192.5.50.254', '192.5.10.12'],
  ]) }),

  tstep('6.2', 'Réserver une adresse fixe pour le Wi-Fi'),
  block('html', { html: '<p>Le <strong>point d’accès Wi-Fi</strong> doit toujours avoir la <strong>même adresse</strong>. On crée une <strong>réservation</strong> : on associe son adresse matérielle (<strong>MAC</strong>) à l’adresse <code>192.5.50.251</code> (hors du pool <code>.1–.200</code>, donc aucun conflit).</p>' }),
  simWin(
    swFrame('📌', 'Nouvelle réservation',
      '<div class="sw-row"><span class="l">Nom de la réservation :</span><span class="sw-in" style="width:150px">Reservation Wifi</span></div>'
      + `<div class="sw-row"><span class="l">Adresse IP :</span>${kbx(1, swIp('192.5.50.251'))}</div>`
      + '<div class="sw-row"><span class="l">Adresse MAC :</span><span class="sw-in" style="width:180px;font-family:ui-monospace,monospace">00-15-5D-0A-1B-2C</span></div>',
      '<span class="sw-btn def">Ajouter</span><span class="sw-btn">Fermer</span>'),
    'Console DHCP → étendue Stagiaires → « Réservations » → « Nouvelle réservation… ».',
    ['L’<strong>adresse réservée</strong> pour le Wi-Fi : <code>192.5.50.251</code>, liée à l’<strong>adresse MAC</strong> du point d’accès.']),
  note('gray', 'ℹ️ Exclusions', '<p>Les autres IP fixes de l’infra (Routeur_G5 <code>.252</code>, Sw-2 <code>.253</code>, passerelle <code>.254</code>) sont déjà <strong>au-dessus du pool</strong> → rien à exclure. Côté Admin, le poste en IP fixe est géré par <strong>réservation</strong> (ex. <code>192.5.10.5</code>).</p>'),
  tstep('6.3', 'Relais DHCP sur le routeur (pour les postes de l’autre réseau)'),
  block('html', { html: '<p>Le serveur DHCP est dans le réseau Admin ; les postes Utilisateurs sont <strong>derrière le routeur</strong> → leurs demandes ne le franchissent pas toutes seules. On ajoute une ligne sur le routeur (<code>ip helper-address</code>) qui <strong>transmet</strong> leurs demandes au serveur. Cette partie se fait <strong>en ligne de commande</strong> sur le routeur :</p>' }),
  cmd(`configure terminal
interface GigabitEthernet0/1
 ip helper-address 192.5.10.12
 exit
end
write memory`),
  note('yellow', '🧪 Sans relais, pas d’adresse', '<p>Sans <code>ip helper-address</code>, les postes Stagiaire/Formateur ne reçoivent <strong>aucune adresse</strong> (leur broadcast DHCP reste bloqué au routeur).</p>'),
  block('html', { html: '<p><strong>Vérification</strong> (sur un poste du réseau Utilisateurs) :</p>' }),
  cmd(`ipconfig /release
ipconfig /renew
ipconfig /all      REM IP dans la plage .1-.200, passerelle .254, DNS 192.5.10.12`),
  figure('/uploads/plat1-dhcp-baux.png', 'Baux d’adresses attribués côté serveur (ex. PC-Jean-Marc → 192.5.10.1).'),
  note('gray', '🔗 Détails', '<p><a href="/pages/procedure-dhcp">DHCP : étendue, options & réservation</a> · <a href="/pages/procedure-dhcp-relais">DHCP par relais (ip helper-address)</a>.</p>'),

  // ── Étape 7 ──
  railClose,
  pageBreak('Étape 7 — Routage & Internet (NAT)'),
  step('7', 'Routage inter-routeurs & accès Internet', 'NAT/PAT sur le routeur de bordure + routes par défaut', C.nat),
  railOpen(C.nat),
  note('blue', '🎯 Objectif', '<p>Assurer le <strong>routage inter-réseaux</strong> et l’<strong>accès Internet</strong>. Deux routeurs : <strong>R_IT_G5</strong> (interne, route entre Admin et Utilisateurs) et <strong>Routeur_G5</strong> (bordure, vers la salle <code>172.16.3.0/24</code>). Le routeur de bordure réalise le <strong>NAT/PAT (overload)</strong> : il traduit les adresses privées derrière l’adresse publique de son interface WAN. Configuration en ligne de commande sur les deux routeurs.</p>'),
  block('html', { html: tbl(['Routeur', 'Interface', 'IP', 'Rôle NAT'], [
    ['Routeur_G5', 'LAN (vers Sw-2)', '192.5.50.252 /24', 'ip nat inside'],
    ['Routeur_G5', 'WAN (vers salle)', '172.16.3.250 /24', 'ip nat outside'],
    ['R_IT_G5', 'LAN Utilisateurs', '192.5.50.254 /24', '—'],
    ['R_IT_G5', 'LAN Admin', '192.5.10.14 /28', '—'],
  ]) }),
  block('heading', { level: 4, text: 'Configuration de Routeur_G5 (bordure)' }),
  block('html', { html: '<p><strong>NAT/PAT</strong> : l’ACL <code>LAN</code> désigne les réseaux <em>internes</em> à traduire ; le PAT (<code>overload</code>) les masque tous derrière l’IP de l’interface WAN.</p>' }),
  cmd(`enable
configure terminal
hostname Routeur_G5
!
! --- Interfaces ---
interface FastEthernet0/0
 description LAN Utilisateurs
 ip address 192.5.50.252 255.255.255.0
 ip nat inside
 no shutdown
 exit
interface FastEthernet0/1
 description Sortie salle / autres ecoles
 ip address 172.16.3.250 255.255.255.0     ! IP WAN fournie par la salle
 ip nat outside
 no shutdown
 exit
!
! --- NAT/PAT : les reseaux internes sortent derriere l'IP WAN ---
ip access-list standard LAN
 permit 192.5.50.0 0.0.0.255
 permit 192.5.10.0 0.0.0.15
 exit
ip nat inside source list LAN interface FastEthernet0/1 overload
!
! --- Routage ---
ip route 0.0.0.0 0.0.0.0 172.16.3.254             ! sortie Internet (passerelle salle)
ip route 192.5.10.0 255.255.255.240 192.5.50.254  ! LAN Admin, via R_IT_G5
end
write memory`),
  block('heading', { level: 4, text: 'Complément sur R_IT_G5 (indispensable pour Internet)' }),
  note('red', '⚠️ Route par défaut manquante = pas d’Internet', '<p>Les clients ont R_IT_G5 pour passerelle : il doit renvoyer tout l’inconnu vers Routeur_G5. Sans cette route par défaut, le trafic Internet s’arrête sur R_IT_G5.</p>'),
  cmd(`! sur R_IT_G5
configure terminal
ip route 0.0.0.0 0.0.0.0 192.5.50.252
end
write memory`),
  block('html', { html: '<p><strong>Vérification</strong> :</p>' }),
  cmd(`! sur Routeur_G5
show ip route             ! une seule default -> 172.16.3.254
show access-lists LAN     ! permit 192.5.50.0 / 192.5.10.0
show ip nat translations  ! des lignes apparaissent quand un client sort
! sur un client du LAN
ping 172.16.3.254         ! passerelle WAN
ping 8.8.8.8              ! Internet (via PAT)`),

  block('heading', { level: 4, text: 'Accès externe au site (redirection de port)' }),
  note('blue', '🌍 Publier le site vers la salle', '<p>Le serveur <code>192.5.10.12</code> est en <strong>adresse privée</strong> → injoignable directement depuis la salle. On <strong>publie le port 8080</strong> de Routeur_G5 vers le serveur (NAT statique entrant / port forwarding). <strong>NAT = joindre</strong> ; c’est indépendant du DNS.</p>'),
  cmd(`! sur Routeur_G5 — rediriger le port 8080 externe vers le serveur IIS
configure terminal
ip nat inside source static tcp 192.5.10.12 8080 interface FastEthernet0/1 8080
end
write memory
! depuis la salle :  http://172.16.3.250:8080
! (confort : publier le port 80 -> 8080 pour eviter de taper :8080)
! ip nat inside source static tcp 192.5.10.12 8080 interface FastEthernet0/1 80`),
  note('yellow', '🌐 Résolution du nom (DNS) pour la salle', '<p>Votre DNS (SRV-1) résout <code>www.Groupe05-EDIVN.lan → 192.5.10.12</code>, une IP <strong>privée inatteignable</strong> de l’extérieur. Deux options :</p><ul><li><strong>Le plus simple</strong> : la salle accède par l’<strong>IP publique</strong> <code>http://172.16.3.250:8080</code> — aucun DNS requis.</li><li><strong>Par le nom</strong> : ajouter sur le <strong>DNS de la salle</strong> un enregistrement <code>www.Groupe05-EDIVN.lan → 172.16.3.250</code> (l’IP <strong>WAN</strong>, pas la privée) — c’est du <strong>DNS « split »</strong> (interne = <code>.10.12</code>, externe = <code>172.16.3.250</code>).</li></ul><p>⚠️ Le DNS ne transporte <strong>pas</strong> de port : la salle tape <code>:8080</code> (sauf si vous publiez le port 80).</p>'),
  note('gray', '🧪 Vérification', '<p><code>show ip nat translations</code> (l’entrée statique <code>tcp</code> apparaît) · depuis la salle, ouvrir <code>http://172.16.3.250:8080</code> · penser à <strong>autoriser HTTP entrant</strong> dans le pare-feu Windows de SRV-1.</p>'),
  note('gray', '🔗 Détails', '<p><a href="/pages/procedure-routes-statiques">Routes statiques</a> · <a href="/pages/cisco-nat">NAT / PAT</a> · <a href="/pages/procedure-cisco-routeur-cli">Config routeur Cisco (CLI)</a>.</p>'),

  // ── Étape 8 ──
  railClose,
  pageBreak('Étape 8 — Wi-Fi (WAP 371)'),
  step('8', 'Point d’accès Wi-Fi — Cisco WAP 371', 'SSID EDWIN05, IP fixe, clients en DHCP', C.wifi),
  railOpen(C.wifi),
  block('html', { html: '<p>Le WAP 371 diffuse le Wi-Fi des stagiaires/formateurs. Il reçoit une <strong>IP fixe</strong> (<code>192.5.50.251</code>) et ses clients obtiennent leur IP par <strong>DHCP</strong> (le relais de l’étape 6 est déjà en place).</p>' }),
  ul([
    'Attribuer au WAP l’<strong>IP fixe <code>192.5.50.251</code></strong> (masque <code>/24</code>, passerelle <code>192.5.50.254</code>) et le connecter en port access sur <strong>Sw-2</strong>.',
    'Accéder à l’interface d’administration du WAP (navigateur → IP du point d’accès).',
    'Créer le <strong>SSID</strong> <code>SSID-EDWIN05</code>, activer la <strong>sécurité WPA2-PSK</strong> et définir la clé.',
    'Laisser les clients Wi-Fi en <strong>DHCP</strong> (ils tombent dans l’étendue Utilisateurs <code>.1–.200</code>).',
  ]),
  note('yellow', '🔍 Vérification', '<p>Associer un client au SSID <code>SSID-EDWIN05</code> → il doit recevoir une <strong>IP <code>192.5.50.x</code></strong> par DHCP, joindre sa passerelle <code>.254</code> et accéder au site / à Internet.</p>'),

  railClose,

  pageBreak('Tests de validation & dépannage'),
  block('heading', { level: 2, text: '✅ Tests de validation (bout en bout)' }),
  ul([
    '<strong>SSH</strong> depuis le poste admin vers R_IT_G5, SW-1, Sw-2 et Routeur_G5 (<code>ssh -l admin &lt;IP&gt;</code>).',
    '<strong>DHCP</strong> : un client Utilisateurs reçoit une IP <code>.1–.200</code>, passerelle <code>.254</code>, DNS <code>192.5.10.12</code>.',
    '<strong>Routage inter-réseaux</strong> : depuis un client, <code>ping 192.5.10.12</code> (serveur) et <code>ping 192.5.10.14</code> (passerelle Admin).',
    '<strong>DNS</strong> : <code>nslookup www.Groupe05-EDIVN.lan</code> → <code>192.5.10.12</code>.',
    '<strong>Web</strong> : <code>http://www.Groupe05-EDIVN.lan:8080</code> et l’intranet s’affichent.',
    '<strong>Internet</strong> : <code>ping 8.8.8.8</code> depuis un client ; <code>show ip nat translations</code> se remplit sur Routeur_G5.',
    '<strong>Wi-Fi</strong> : association au SSID <code>SSID-EDWIN05</code> + IP DHCP.',
  ]),

  block('heading', { level: 2, text: '🧰 Pièges fréquents & dépannage' }),

  acc('① Les VM ne communiquent pas — commutateur externe sur la mauvaise carte', [
    block('html', { html: '<p><strong>Symptôme</strong> : les VM n’ont pas de connectivité vers la maquette.<br><strong>Cause</strong> : le <strong>commutateur virtuel externe</strong> Hyper-V est rattaché à la <strong>mauvaise carte réseau physique</strong>.<br><strong>Solution</strong> : Gestionnaire Hyper-V → <em>Gestionnaire de commutateur virtuel</em> → commutateur <strong>Externe</strong> → sélectionner la <strong>bonne carte</strong> → OK. Vérifier ensuite, dans les <em>Paramètres</em> de chaque VM, que la carte réseau est connectée à ce commutateur.</p>' }),
  ]),

  acc('② SSH ne fonctionne pas — clé RSA invalide ou client Windows incompatible', [
  note('yellow', '🔑 Cause 1 & solution : clé RSA', '<p>La <strong>clé RSA</strong> a été générée <strong>avant</strong> d’avoir fixé le <code>hostname</code> et le <code>ip domain-name</code> (ou l’équipement a été renommé ensuite) → la clé porte un mauvais nom. <strong>Solution</strong> : fixer hostname + domaine, puis <strong>supprimer et régénérer</strong> la clé.</p>'),
  cmd(`configure terminal
ip domain-name edivn.lan
crypto key zeroize rsa          ! supprime l'ancienne cle
crypto key generate rsa
1024                            ! la longueur, seule sur sa ligne
ip ssh version 2
line vty 0 4
 login local
 transport input ssh
 exit
end
! Verifications :
show ip ssh                     ! doit indiquer SSH Enabled, version 2.0
show crypto key mypubkey rsa    ! la cle doit exister
! Test depuis un client : ssh -l admin 192.5.10.13`),
  note('red', '🖥️ Cause 2 & solution : client SSH Windows incompatible → PuTTY / MobaXterm', '<p>Même avec une clé valide, la connexion peut échouer avec un message du type <em>« Unable to negotiate… no matching key exchange method / host key type »</em>. Le <strong>client OpenSSH natif de Windows</strong> (commande <code>ssh</code>) <strong>désactive par défaut les algorithmes hérités</strong> (<code>diffie-hellman-group1-sha1</code>, clé d’hôte <code>ssh-rsa</code>, chiffrements <code>aes-cbc</code>/<code>3des</code>) que les <strong>anciens IOS Cisco du lab</strong> sont seuls à proposer → aucune négociation possible.</p><p><strong>Solution : se connecter avec <a href="https://www.putty.org/" target="_blank" rel="noopener">PuTTY</a> ou <a href="https://mobaxterm.mobatek.net/" target="_blank" rel="noopener">MobaXterm</a></strong>, qui prennent encore en charge ces algorithmes hérités. C’est la méthode fiable sur le matériel à disposition.</p>'),
  ul([
    '<strong>PuTTY</strong> : <em>Host Name</em> = l’IP de l’équipement (ex. <code>192.5.10.13</code>), <em>Port</em> <code>22</code>, <em>Connection type</em> <strong>SSH</strong> → <em>Open</em>, puis login <code>admin</code> / <code>cisco</code>.',
    '<strong>MobaXterm</strong> : <em>Session → SSH</em>, <em>Remote host</em> = l’IP, <em>Specify username</em> = <code>admin</code> → OK.',
    'Dépannage seulement, si l’on tient au client natif : <code>ssh -o KexAlgorithms=+diffie-hellman-group1-sha1 -o HostKeyAlgorithms=+ssh-rsa -l admin &lt;IP&gt;</code> (moins pratique — PuTTY/MobaXterm restent conseillés).',
  ]),
  note('gray', 'ℹ️ À contrôler aussi', '<ul><li>Un <strong>compte local</strong> existe : <code>username admin privilege 15 secret cisco</code>.</li><li>Modulus <strong>≥ 768</strong> (1024 recommandé) pour SSHv2.</li><li>Utilisez <strong>SSH</strong> (pas <code>telnet</code>).</li></ul>'),
  ]),

  acc('③ Ping d’un poste vers le serveur qui échoue (l’inverse fonctionne)', [
  note('yellow', '🛡️ Cause & solution : pare-feu Windows du serveur', '<p>Si le sens <strong>Serveur → poste</strong> fonctionne, le <strong>routage est bon</strong>. Ce qui échoue, c’est le <strong>ping entrant</strong> : le <strong>pare-feu Windows</strong> bloque par défaut l’<strong>ICMP entrant</strong> non sollicité (surtout depuis un autre sous-réseau). <strong>Solution : autoriser l’ICMP echo entrant</strong> sur le serveur.</p>'),
  cmd(`REM Sur le SERVEUR Windows (invite admin) — autoriser le ping entrant IPv4 :
netsh advfirewall firewall add rule name="ICMPv4 Echo In" protocol=icmpv4:8,any dir=in action=allow

REM ou en PowerShell (admin) :
Enable-NetFirewallRule -DisplayName "Partage de fichiers et d'imprimantes (demande d'echo - trafic entrant ICMPv4)"`),
  note('gray', 'ℹ️ Détail', '<p>Pas-à-pas illustré : <a href="/pages/astuce-pare-feu-ping">Autoriser le ping (ICMP) dans le pare-feu</a>.</p>'),
  ]),

  acc('④ Impossible de pinguer un autre réseau depuis un hôte Hyper-V à deux cartes', [
  note('yellow', '🔎 Diagnostic', '<p>D’abord vérifier l’évidence : sur R_IT_G5, <code>show ip interface brief</code> (les 2 interfaces <strong>up/up</strong>) et, côté client, <code>ipconfig /all</code> (bon masque <strong>/24</strong> et <strong>passerelle par défaut</strong> <code>192.5.50.254</code>). <strong>Piège</strong> : pinguer sa <em>propre</em> passerelle réussit même sans passerelle par défaut (même sous-réseau) — ça ne prouve rien sur le routage.</p>'),
  note('red', '🎯 Cause fréquente : hôte multi-homé (2 passerelles par défaut)', '<p>Si vous testez depuis l’<strong>hôte Hyper-V</strong> et qu’il a <strong>deux cartes</strong> (une physique DHCP vers la salle <code>172.16.3.x</code>, une vEthernet du lab <code>192.5.50.x</code>), Windows applique la <strong>route par défaut de la carte physique</strong> pour tout réseau non directement connecté. Le ping part alors <strong>vers Internet</strong> au lieu du routeur du lab — le routage Cisco n’est pas en cause.</p>'),
  cmd(`:: preuve : le 1er saut sort par la mauvaise carte
tracert -d 192.5.10.14      ! 1er saut = 172.16.3.254 => mauvais chemin

:: fix ponctuel : router le reseau Admin par le routeur du lab
route add 192.5.10.0 mask 255.255.255.240 192.5.50.254 -p
tracert -d 192.5.10.14      ! 1er saut doit devenir 192.5.50.254`),
  note('green', '✅ Solutions', '<p>(1) Tester depuis une <strong>VM à une seule carte</strong> sur le réseau Utilisateurs (elle atteint l’autre réseau sans rien ajouter) ; ou (2) <strong>désactiver la carte inutile</strong> le temps du test ; ou (3) ne garder <strong>qu’une seule passerelle par défaut</strong> sur l’hôte + des <strong>routes statiques</strong> vers les sous-réseaux du lab.</p>'),
  note('gray', '🔗 Méthode', '<p><a href="/pages/procedure-test-connectivite">Test de connectivité méthodique</a> (dérouler dans l’ordre : lien → passerelle → réseau distant).</p>'),
  ]),

  acc('⑤ Câble RJ45 débranché — simple mais très bloquant', [
    note('yellow', '🔌 Le réflexe à avoir', '<p>Un câble <strong>RJ45</strong> mal enclenché (languette cassée, prise à demi enfoncée) peut se <strong>débrancher tout seul</strong> — parfois sans qu’on y touche. Résultat : une machine ou un segment entier tombe, alors que <strong>toute la configuration est correcte</strong>. On cherche longtemps un problème logiciel qui n’existe pas.</p>'),
    ul([
      'Symptômes : lien <code>down/down</code> sur <code>show ip interface brief</code>, voyant de port <strong>éteint</strong>, plus de ping, un poste qui perd son bail DHCP.',
      '<strong>Vérifiez physiquement les câbles périodiquement</strong> — surtout après avoir bougé un équipement, et dès qu’un test échoue « sans raison ».',
      'Réenclenchez à fond jusqu’au <em>clic</em>. Si la languette est cassée, <strong>remplacez le câble</strong>.',
      'Contrôlez les deux extrémités (côté machine <em>et</em> côté switch) et les liaisons montantes routeur ↔ switch.',
    ]),
    note('gray', '💡 Avant de suspecter la config', '<p>Face à une panne réseau soudaine, commencez <strong>toujours</strong> par la <strong>couche 1</strong> (câble, voyant, port) avant de rouvrir la CLI. C’est la cause la plus fréquente et la plus vite écartée.</p>'),
  ]),
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
  // Tête (hero, styles, bouton PDF) TOUJOURS visible ; le reste passe dans le lecteur de pages (doc-pager).
  const HEAD = 3;
  const contentHtml = renderPageBlocksToHtml(blocks.slice(0, HEAD))
    + `<div class="pb-dynamic" data-block="doc-pager">${renderPageBlocksToHtml(blocks.slice(HEAD))}</div>`;
  const body = JSON.stringify({ title: PAGE.title, slug: PAGE.slug, excerpt: PAGE.excerpt, content: contentHtml, builder_json: serializePageBlocks(blocks), published: 1 });
  const res = cur ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body }) : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
  console.log(`PAGE ${PAGE.slug}`, res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());
  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

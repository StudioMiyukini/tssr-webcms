/* Cours « Les GPO (stratégies de groupe) » — théorie AD + exemple pratique (mappage de lecteur réseau).
   Enrichi à partir du document capture (domaine adrar.lan : OU, GPO liée, Préférences → Mappages de lecteurs).
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cours-gpo.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = { slug: 'cours-gpo', title: 'Les GPO (stratégies de groupe)', excerpt: 'Comprendre et utiliser les stratégies de groupe (GPO) d’Active Directory : portée (LSDOU), héritage/blocage, priorité, filtrage, lien vs objet, stratégies vs préférences, rafraîchissement (gpupdate). Trois exemples complets (lecteur réseau, fond d’écran, déploiement .msi), la méthode pour bloquer l’invite de commandes, et un TP guidé (ciblage par groupe, blocage d’héritage).' };
const block = (type: Parameters<typeof makePageBlock>[0], patch: Partial<PageBlock>) => Object.assign(makePageBlock(type), patch);
const note = (cls: string, title: string, html: string) => block('html', { html: `<aside class="pb-note pb-note-${cls}"><p class="pb-note-title">${title}</p>${html}</aside>` });
const html = (h: string) => block('html', { html: h });
const h2 = (text: string) => block('heading', { level: 2, text });
const h3 = (text: string) => block('heading', { level: 3, text });

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cmd = (t: string) => `<div class="gpo-cmd">${esc(t)}</div>`;
const hl = (t: string) => `<span class="gpo-hl">${t}</span>`;
// Fenêtre Windows simulée : barre de titre + corps.
const win = (title: string, body: string) => `<div class="gpo-win"><div class="gpo-tb"><span class="gpo-ic">🪟</span><span class="gpo-tt">${title}</span><span class="gpo-x">✕</span></div><div class="gpo-body">${body}</div></div>`;
// Tableau générique.
const tbl = (head: string[], rows: string[][]) => `<div class="gpo-tblwrap"><table class="gpo-tbl"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td${i === 0 ? ' class="k"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

const UNC = '\\\\SRVAD\\share_ADRAR\\Service_production'; // rendu : \\SRVAD\share_ADRAR\Service_production
const UNC_FOND = '\\\\srvad\\gpo$\\fond.jpg';               // fond d’écran (partage masqué gpo$)
const UNC_MSI = '\\\\SRVAD\\logiciels\\7z-x64.msi';         // paquet .msi sur un partage
const S = '\\\\SRVAD\\Fichiers';                            // racine du partage du TP

const STYLE = `<style>
.gpo-cmd{font-family:ui-monospace,'Cascadia Mono',monospace;background:#0c0c0c;color:#e6e6e6;border:1px solid #000;border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.5}
.gpo-hl{background:color-mix(in srgb,#dc2626 16%,transparent);outline:2px solid #dc2626;border-radius:4px;padding:0 4px;font-weight:600}
.gpo-win{border:1px solid var(--border);border-radius:8px;overflow:hidden;margin:12px 0;box-shadow:0 4px 16px rgba(0,0,0,.14);background:var(--surface)}
.gpo-tb{display:flex;align-items:center;gap:8px;padding:7px 10px;background:linear-gradient(#f3f5f9,#e7ebf1);border-bottom:1px solid var(--border);color:#1b2a3a}
:root[data-theme=dark] .gpo-tb{background:linear-gradient(#26303c,#1c2430);color:#dbe7f5}
.gpo-tt{font-weight:700;font-size:12.5px;flex:1}.gpo-x{color:#c42b1c;font-weight:700}
.gpo-body{padding:12px 14px;font-size:13px;line-height:1.55}
.gpo-tree{font-family:ui-monospace,monospace;font-size:12.5px;line-height:1.7;margin:0;white-space:pre}
.gpo-kv{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;align-items:center;margin:6px 0}
.gpo-kv .lb{color:var(--text-muted);font-size:12.5px}
.gpo-fld{border:1px solid var(--border);border-radius:6px;padding:4px 8px;background:var(--surface-2);font-family:ui-monospace,monospace;font-size:12.5px}
.gpo-tblwrap{overflow-x:auto;margin:10px 0}
.gpo-tbl{border-collapse:collapse;width:100%;font-size:13px;min-width:520px}
.gpo-tbl th,.gpo-tbl td{border:1px solid var(--border);padding:7px 10px;text-align:left;vertical-align:top}
.gpo-tbl th{background:var(--surface-2);font-weight:700}
.gpo-tbl td.k{font-weight:600;white-space:nowrap}
.gpo-steps{padding-left:20px;line-height:1.75}.gpo-steps>li{margin:7px 0}
.gpo-path{font-family:ui-monospace,monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:6px;padding:2px 6px;font-size:12px}
</style>`;

const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Active Directory', title: PAGE.title, subtitle: 'Configurer et sécuriser en masse tous les postes et utilisateurs d’un domaine, depuis une seule console — au lieu de régler chaque machine à la main.' }),
  html(STYLE),
  note('blue', '🎯 En une phrase', `<p>Une <strong>GPO</strong> (Group Policy Object, « stratégie de groupe ») est un <strong>ensemble de réglages</strong> qu’Active Directory <strong>applique automatiquement</strong> à des <strong>ordinateurs</strong> et/ou des <strong>utilisateurs</strong> du domaine : mot de passe, lecteurs réseau, fond d’écran, restrictions, pare-feu, logiciels… On les gère dans la console <strong>Gestion des stratégies de groupe</strong> (<code>gpmc.msc</code>). Prérequis : un domaine AD (voir <a href="/pages/administration-domaine-ad">Administration d’un domaine AD</a>).</p>`),

  h2('1) Qu’est-ce qu’une GPO ?'),
  html(`<p>Sans GPO, l’administrateur configurerait <strong>chaque poste un par un</strong>. Avec une GPO, il définit le réglage <strong>une seule fois</strong> dans AD, et le domaine le <strong>pousse</strong> vers toutes les machines/utilisateurs concernés. C’est le cœur de l’administration <strong>centralisée</strong>.</p>`),
  tbl(['Élément', 'Rôle'], [
    ['GPO', 'Le « conteneur » de réglages. Stockée dans <code>SYSVOL</code> sur les contrôleurs de domaine et répliquée entre eux.'],
    ['GPMC', 'La console <strong>Gestion des stratégies de groupe</strong> (<code>gpmc.msc</code>) : créer, lier, filtrer, sauvegarder les GPO.'],
    ['Éditeur GPO', 'L’<strong>Éditeur de gestion des stratégies de groupe</strong> : régler le contenu d’une GPO (les deux moitiés ci-dessous).'],
    ['Lien (link)', 'Une GPO n’agit que si elle est <strong>liée</strong> à un conteneur AD : Site, Domaine ou <strong>Unité d’organisation (OU)</strong>.'],
  ]),
  note('green', '💡 Deux GPO « par défaut »', `<p>Tout domaine a la <strong>Default Domain Policy</strong> (liée au domaine — surtout la politique de mot de passe) et la <strong>Default Domain Controllers Policy</strong> (liée à l’OU <em>Domain Controllers</em>). Bonne pratique : ne pas les surcharger, créer <strong>ses propres GPO</strong>.</p>`),
  note('blue', '🔗 Lien ≠ objet GPO (à retenir absolument)', `<p>Une GPO <strong>existe une seule fois</strong> dans le conteneur <strong>« Objets de stratégie de groupe »</strong> du domaine. Ce que tu vois sous une OU n’est qu’un <strong>lien</strong> (un raccourci) vers cet objet — et une même GPO peut être <strong>liée à plusieurs OU</strong>. Conséquence : « <strong>Supprimer</strong> » une GPO <em>depuis une OU</em> ne supprime que le <strong>lien</strong> ; l’objet reste dans « Objets de stratégie de groupe » (et s’applique toujours ailleurs). Pour la <strong>supprimer réellement</strong>, il faut le faire dans « Objets de stratégie de groupe ».</p>`),

  h2('2) Où s’appliquent-elles ? Portée, ordre et héritage'),
  html(`<p>Une GPO s’applique à tous les objets (ordinateurs/utilisateurs) situés <strong>dans le conteneur où elle est liée</strong>, et par <strong>héritage</strong> dans les sous-OU. Quand plusieurs GPO se superposent, Windows les applique dans l’ordre <strong>LSDOU</strong> :</p>`),
  html(`<div class="gpo-tree">1. <b>L</b>ocal        (stratégie locale de la machine)
2. <b>S</b>ite         (site AD)
3. <b>D</b>omaine      (ex. Default Domain Policy)
4. <b>O</b>U ───────▶  la plus <b>proche de l’objet</b> gagne
        └─ sous-OU  (appliquée en dernier = <b>priorité la plus forte</b>)</div>`),
  note('yellow', '⚖️ Règle d’or', `<p>La <strong>dernière appliquée l’emporte</strong> : en cas de conflit sur un même réglage, c’est la GPO liée à l’OU <strong>la plus profonde</strong> (la plus proche de l’objet) qui gagne. Entre deux GPO liées au <em>même</em> conteneur, l’<strong>ordre des liens</strong> décide (le n°1 gagne).</p>`),
  tbl(['Mécanisme', 'Effet'], [
    ['Héritage', 'Une OU hérite des GPO des conteneurs parents (domaine, OU supérieures).'],
    ['Bloquer l’héritage', 'Sur une OU : ignore les GPO héritées des parents (⚠️ sauf celles « Appliquées »).'],
    ['Appliqué (Enforced)', 'Force la GPO à s’appliquer <strong>malgré</strong> un blocage d’héritage et à <strong>gagner</strong> les conflits.'],
    ['Lien activé', 'Un lien peut être <strong>désactivé</strong> sans supprimer la GPO (utile pour tester).'],
    ['Filtrage de sécurité', 'Restreindre l’application à un <strong>groupe</strong> de sécurité précis (par défaut : <em>Utilisateurs authentifiés</em>).'],
    ['Filtre WMI', 'Condition matérielle/logicielle (ex. « seulement les Windows 11 », « seulement les portables »).'],
  ]),
  html(`<p>Exemple d’arborescence (domaine <strong>adrar.lan</strong>) : les OU par service, et des GPO liées <strong>au bon niveau</strong>.</p>`),
  html(win('Gestion de stratégie de groupe — adrar.lan', `<div class="gpo-tree">📁 adrar.lan
 ├─ 📄 Default Domain Policy
 ├─ 📄 ${hl('strategie mot de passe')}         (liée au domaine)
 ├─ 📁 Domain Controllers
 └─ 📁 UO_entreprise
     ├─ 📁 Service_admin_juridique
     │   ├─ 📁 Administration   ← 📄 ${hl('Administration')} (GPO liée ici)
     │   ├─ 📁 Audit_interne
     │   └─ 📁 Service_juridique
     ├─ 📁 Service_commercial (Marketing · Produit · SAV)
     ├─ 📁 Service_Direction
     ├─ 📁 Service_RH (Recrutement · RH)
     └─ 📁 ${hl('Service_production')}   ← on y liera la GPO « lecteur K: »</div>`)),
  note('yellow', '⚠️ Une GPO se lie à une OU, un site ou le domaine — jamais à un groupe', `<p>On <strong>ne lie pas</strong> une GPO à un groupe AD. Elle s’applique aux <strong>utilisateurs et ordinateurs</strong> contenus dans le conteneur. Pour restreindre à un groupe précis, on utilise le <strong>filtrage de sécurité</strong> (ou le <em>ciblage d’élément</em> pour une préférence).</p>`),
  html(`<p>L’onglet <strong>Héritage de stratégie de groupe</strong> d’une OU récapitule <strong>tout</strong> ce qui s’y applique, classé par <strong>priorité</strong> (la n°<strong>1</strong> gagne). Exemple réel sur l’OU <strong>Usine_3</strong> :</p>`),
  html(tbl(['Priorité', 'GPO', 'Liée à'], [
    ['1', 'Lecteur reseau_service production_K:', 'Usine_3 <em>(OU la plus profonde)</em>'],
    ['2', 'mappage logistique L:', 'Usine_3'],
    ['3 – 4', 'Lecteur reseau · Copie', 'Service_production'],
    ['5 – 6', 'Lecteur reseau · wallpaper_entreprise', 'UO_entreprise'],
    ['7', 'Default Domain Policy', 'adrar.lan <em>(domaine)</em>'],
    ['8', 'Strategie Mot de passe', 'adrar.lan <em>(domaine)</em>'],
  ])),
  note('blue', '🔁 Ordre d’exécution ≠ ordre de priorité', `<p>Windows <strong>exécute</strong> dans l’ordre <strong>LSDOU</strong> (domaine → OU → sous-OU) : la plus profonde <strong>en dernier</strong>. L’ordre d’exécution est donc l’<strong>inverse</strong> de la priorité — la GPO appliquée en dernier (OU la plus profonde) porte la <strong>priorité 1</strong> et l’emporte en cas de conflit.</p>`),

  h2('3) La structure d’une GPO'),
  html(`<p>Chaque GPO a <strong>deux moitiés</strong>, et dans chacune, deux familles de réglages :</p>`),
  html(win('Éditeur de gestion des stratégies de groupe', `<div class="gpo-tree">🖥️ ${hl('Configuration ordinateur')}   ← s’applique à la MACHINE (au démarrage)
   ├─ 📁 Stratégies
   │    ├─ Paramètres Windows
   │    └─ Modèles d’administration
   └─ 📁 Préférences
👤 ${hl('Configuration utilisateur')}   ← s’applique à l’UTILISATEUR (à l’ouverture de session)
   ├─ 📁 Stratégies
   └─ 📁 Préférences
        └─ Paramètres Windows → ${hl('Mappages de lecteurs')}</div>`)),
  tbl(['Moitié', 'Sur quoi ? Quand ?'], [
    ['Configuration ordinateur', 'S’applique à l’<strong>ordinateur</strong>, quel que soit l’utilisateur connecté, au <strong>démarrage</strong> et au rafraîchissement.'],
    ['Configuration utilisateur', 'S’applique à l’<strong>utilisateur</strong>, sur toute machine où il ouvre une session, à l’<strong>ouverture de session</strong>.'],
  ]),

  h2('4) Stratégies vs Préférences (à ne pas confondre)'),
  tbl(['', 'Stratégies (Policies)', 'Préférences (Preferences)'], [
    ['Force le réglage', 'Oui — l’utilisateur ne peut pas le changer (grisé)', 'Non — définit une valeur, l’utilisateur peut souvent la modifier'],
    ['Si la GPO ne s’applique plus', 'Le réglage revient à l’état par défaut', 'Le réglage <strong>reste</strong> (sauf option « Supprimer quand non appliqué »)'],
    ['Ciblage fin', 'Filtrage de sécurité / WMI (au niveau GPO)', '<strong>Ciblage au niveau de l’élément</strong> (par item : groupe, OU, OS…)'],
    ['Exemples', 'Politique de mot de passe, interdictions, modèles d’administration', 'Lecteurs réseau, imprimantes, raccourcis, variables d’environnement, clés de registre'],
  ]),
  note('blue', 'ℹ️ Pourquoi c’est important', `<p>Mapper un lecteur réseau se fait via une <strong>Préférence</strong> (Configuration utilisateur → Préférences → Mappages de lecteurs), pas via une « Stratégie ». C’est exactement l’objet de l’exemple ci-dessous.</p>`),

  h2('5) Application & rafraîchissement'),
  html(`<p>Une GPO n’est pas instantanée. Elle s’applique :</p>`),
  html(`<ul class="gpo-steps">
    <li>au <strong>démarrage</strong> (Configuration ordinateur) et à l’<strong>ouverture de session</strong> (Configuration utilisateur) ;</li>
    <li>puis <strong>en arrière-plan</strong>, automatiquement, environ toutes les <strong>${hl('90 minutes')}</strong> (+ un délai aléatoire de 0 à 30 min pour ne pas surcharger le serveur) ;</li>
    <li>sur les <strong>contrôleurs de domaine</strong>, ce rafraîchissement est plus court : <strong>${hl('≈ 5 minutes')}</strong> ;</li>
    <li>à la demande, avec la commande <code>gpupdate</code>.</li>
  </ul>`),
  html(cmd('gpupdate /force        (recharge TOUTES les stratégies, ordinateur + utilisateur)')),
  html(`<p>Sur le poste client, l’application réussie affiche :</p>`),
  html(cmd(`C:\\Users\\ana.amari>gpupdate /force
Updating policy...

Computer Policy update has completed successfully.
User Policy update has completed successfully.`)),
  note('yellow', '⏱️ Certains réglages exigent plus', `<p>Quelques paramètres (installation de logiciels, redirection de dossiers, certains scripts) ne s’appliquent qu’au <strong>prochain redémarrage</strong> ou à la <strong>prochaine ouverture de session</strong> — <code>gpupdate /force</code> peut proposer de fermer la session / redémarrer.</p>`),

  h2('6) Exemple 1 — mapper un lecteur réseau par GPO'),
  html(`<p><strong>Objectif :</strong> chaque membre du <strong>Service Production</strong> doit voir automatiquement un lecteur <span class="gpo-path">K:</span> pointant vers le partage <span class="gpo-path">${UNC}</span>. On crée une GPO liée à l’OU <strong>Service_production</strong>, avec une <strong>préférence</strong> de mappage de lecteur.</p>`),
  note('blue', '📁 C’est quoi un chemin UNC ?', `<p><strong>UNC</strong> (<em>Universal Naming Convention</em>) = le chemin d’un dossier ou fichier <strong>partagé</strong>, vu depuis le réseau : <span class="gpo-path">\\\\[nom_serveur]\\[nom_du_partage]\\[sous-dossier…]</span> — ex. <span class="gpo-path">${UNC}</span>. Il ne dépend d’<strong>aucune lettre de lecteur</strong> et fonctionne depuis n’importe quel poste : c’est <strong>toujours</strong> lui qu’on renseigne dans une GPO (lecteur mappé, fond d’écran, paquet .msi) — <strong>jamais</strong> un chemin local <code>C:\\…</code> du serveur, que les clients ne voient pas. Un partage terminé par <code>$</code> (ex. <span class="gpo-path">\\\\srvad\\gpo$</span>) est <strong>masqué</strong>. Définition : <a href="/glossaire#gt-unc">UNC dans le glossaire</a>.</p>`),
  note('yellow', '📌 Prérequis : le partage doit exister ET être sécurisé', `<p>La GPO <em>monte</em> le lecteur, mais l’accès dépend des <strong>droits</strong>. Vérifie que le <strong>groupe du service</strong> (ex. <code>gg_Production</code>, <code>G_Commerciaux</code>…) a les <strong>droits NTFS</strong> voulus (lecture ou lecture/écriture) sur le dossier, et que le <strong>partage</strong> autorise l’accès. Sinon le lecteur apparaît mais reste <strong>inaccessible</strong>. Voir <a href="/pages/permissions-partage-ntfs">Partage &amp; NTFS</a>.</p>`),

  h3('Étape 1 — Créer la GPO et la lier à l’OU'),
  html(`<ol class="gpo-steps">
    <li>Ouvrir <strong>Gestion des stratégies de groupe</strong> (<code>gpmc.msc</code>).</li>
    <li>Clic droit sur l’OU <strong>${hl('Service_production')}</strong> → « <strong>Créer un objet GPO dans ce domaine, et le lier ici…</strong> ».</li>
    <li>Nommer clairement la GPO : <strong>Stratégie Lecteur reseau_service production_K</strong>.</li>
    <li>Clic droit sur la GPO → <strong>Modifier</strong> pour ouvrir l’éditeur.</li>
  </ol>`),

  h3('Étape 2 — Ajouter le mappage de lecteur (Préférence)'),
  html(`<p>Dans l’éditeur, dérouler : <span class="gpo-path">Configuration utilisateur → Préférences → Paramètres Windows → ${hl('Mappages de lecteurs')}</span> (parfois libellé « <strong>Lecteurs réseau</strong> »). Clic droit → <strong>Nouveau → Lecteur mappé</strong>.</p>`),
  html(win('Nouvelles propriétés de Lecteur — onglet « Général »', `<div class="gpo-kv">
    <span class="lb">Action :</span><span class="gpo-fld">${hl('Mettre à jour')}</span>
    <span class="lb">Emplacement :</span><span class="gpo-fld">${hl(UNC)}</span>
    <span class="lb">Reconnecter :</span><span>☑ &nbsp; Libeller en tant que : <span class="gpo-fld">service production</span></span>
    <span class="lb">Lettre de lecteur :</span><span>◉ Utiliser : <span class="gpo-fld">${hl('K')}</span></span>
    <span class="lb">Afficher :</span><span>◉ Afficher ce lecteur</span>
  </div>`)),
  tbl(['Champ', 'Valeur & pourquoi'], [
    ['Action', '<strong>Mettre à jour</strong> (crée s’il n’existe pas, sinon met à jour). « Remplacer » supprime puis recrée à chaque fois.'],
    ['Emplacement', `Le chemin <strong>UNC</strong> du partage : <span class="gpo-path">${UNC}</span> (nom du serveur + partage).`],
    ['Lettre', 'La lettre imposée : <strong>K:</strong> (« Utiliser » plutôt que « premier disponible » pour une lettre stable).'],
    ['Reconnecter', 'Remonte le lecteur à chaque ouverture de session.'],
    ['Libeller', 'Nom affiché dans l’explorateur (« service production »).'],
  ]),

  h3('Étape 3 — Onglet « Commun » : cibler et nettoyer'),
  html(win('Nouvelles propriétés de Lecteur — onglet « Commun »', `<div class="gpo-body" style="padding:0">
    <label>☑ ${hl('Supprimer l’élément lorsqu’il n’est plus appliqué')}</label><br>
    <label>☐ Exécuter dans le contexte de sécurité de l’utilisateur connecté</label><br>
    <label>☐ ${hl('Ciblage au niveau de l’élément')} &nbsp; [ Ciblage… ]</label>
  </div>`)),
  html(`<ul class="gpo-steps">
    <li><strong>Supprimer l’élément lorsqu’il n’est plus appliqué</strong> : si l’utilisateur quitte l’OU, le lecteur K: disparaît proprement.</li>
    <li><strong>Ciblage au niveau de l’élément</strong> (optionnel) : n’appliquer ce mappage qu’à un <strong>groupe</strong> précis (ex. <code>gg_Production</code>), un OS, un site… On peut ainsi mettre plusieurs mappages dans une même GPO, chacun ciblé différemment.</li>
  </ul>`),

  h3('Étape 4 — Vérifier le contenu (rapport de la GPO)'),
  html(`<p>Dans la GPMC, onglet <strong>Paramètres</strong> de la GPO : le rapport HTML récapitule la préférence (Configuration utilisateur → Préférences → Mappages de lecteurs → K:), avec Action, Emplacement, Reconnecter, Intitulé… Pratique pour <strong>relire</strong> une GPO sans rouvrir l’éditeur.</p>`),

  h3('Étape 5 — Appliquer et constater côté client'),
  html(`<p>Sur le poste de l’utilisateur (ex. <code>ana.amari</code>), forcer la mise à jour :</p>`),
  html(cmd('gpupdate /force')),
  html(`<p>Puis ouvrir l’<strong>Explorateur → Ce PC</strong> : le lecteur apparaît dans <strong>Emplacements réseau</strong>.</p>`),
  html(win('Ce PC — Emplacements réseau', `<div class="gpo-tree">💾 Disque local (C:)
💿 Lecteur DVD (D:)
🖧 ${hl('service production (K:)')}   114 Go libres sur 126 Go   →  ${UNC}
🖧 service production (Z:)   (autre mappage éventuel)</div>`)),
  note('green', '✅ Résultat', `<p>Sans toucher au poste, l’utilisateur du Service Production retrouve son <strong>K:</strong> à chaque connexion. Ajouter un service = créer/copier la GPO et la lier à l’OU voulue.</p>`),

  h2('7) Exemple 2 — imposer un fond d’écran d’entreprise par GPO'),
  html(`<p><strong>Objectif :</strong> appliquer le <strong>fond d’écran de l’entreprise</strong> à tous les utilisateurs d’une OU (ex. <strong>UO_TECHNOGLOBAL</strong>), sans qu’ils puissent le changer. Ici on utilise une vraie <strong>Stratégie</strong> (Modèle d’administration), pas une préférence — le réglage est <strong>verrouillé</strong>.</p>`),
  note('blue', '🆚 Stratégie vs Préférence', `<p>Le lecteur réseau (exemple 1) était une <strong>Préférence</strong> (contournable). Le fond d’écran est une <strong>Stratégie</strong> : l’option « changer le fond » devient <strong>grisée</strong> côté utilisateur.</p>`),

  h3('Étape 1 — Préparer l’image et un partage en lecture seule'),
  html(`<ol class="gpo-steps">
    <li>Sur <strong>SRVAD</strong>, créer le dossier <span class="gpo-path">C:\\gpo</span> et y copier l’image renommée <span class="gpo-path">fond.jpg</span>.</li>
    <li>Clic droit sur le dossier → <strong>Propriétés → Partage → Partage avancé</strong>. Nommer le partage <strong>${hl('gpo$')}</strong> — le <strong>$</strong> le rend <strong>masqué</strong> (invisible dans le voisinage réseau).</li>
    <li><strong>Droits de partage</strong> : <em>Utilisateurs du domaine</em> = <strong>Lecture</strong> · <em>Administrateurs</em> = Contrôle total.</li>
    <li><strong>Droits NTFS</strong> : retirer l’héritage si besoin, puis <em>Administrateurs</em> = Contrôle total, <em>Utilisateurs du domaine</em> = <strong>Lecture seule</strong>.</li>
  </ol>`),
  note('yellow', '🔒 Pourquoi « lecture seule » + partage masqué', `<p>Les utilisateurs doivent pouvoir <strong>lire</strong> l’image (pour l’afficher) mais <strong>jamais la modifier ni la remplacer</strong>. Le partage <strong>$</strong> masqué évite qu’ils tombent dessus par hasard. Chemin réseau utilisé par la GPO : <span class="gpo-path">${UNC_FOND}</span>.</p>`),

  h3('Étape 2 — Créer la GPO et l’éditer'),
  html(`<ol class="gpo-steps">
    <li>Dans <code>gpmc.msc</code>, clic droit sur <strong>UO_TECHNOGLOBAL</strong> → <strong>Créer un objet GPO dans ce domaine, et le lier ici</strong>. La nommer <strong>GPO_FondEcran</strong>.</li>
    <li>Clic droit → <strong>Modifier</strong>, puis aller à : <span class="gpo-path">Configuration utilisateur → Stratégies → Modèles d’administration → Bureau → ${hl('Active Desktop')}</span>.</li>
    <li>Double-cliquer sur <strong>Papier peint du Bureau</strong>.</li>
  </ol>`),
  html(win('Papier peint du Bureau', `<div class="gpo-kv">
    <span class="lb">État :</span><span>◉ ${hl('Activé')}</span>
    <span class="lb">Nom du papier peint :</span><span class="gpo-fld">${hl(UNC_FOND)}</span>
    <span class="lb">Style du papier peint :</span><span class="gpo-fld">${hl('Étiré')}</span>
  </div>`)),
  tbl(['Champ', 'Valeur'], [
    ['État', '<strong>Activé</strong>'],
    ['Nom du papier peint', `<span class="gpo-path">${UNC_FOND}</span> — le chemin <strong>UNC</strong> de l’image (pas un chemin local du serveur).`],
    ['Style du papier peint', '<strong>Étiré</strong> (ou <em>Remplir</em> / <em>Ajusté</em> selon le rendu voulu).'],
  ]),

  h3('Étape 3 — Tester sur un poste client'),
  html(`<ol class="gpo-steps">
    <li>Se connecter avec un utilisateur de l’<strong>UO_TECHNOGLOBAL</strong>.</li>
    <li>Invite de commandes : <code>gpupdate /force</code>.</li>
    <li>Se <strong>déconnecter puis reconnecter</strong> (un fond d’écran utilisateur s’applique proprement à l’ouverture de session).</li>
    <li>Vérifier : le fond est appliqué <strong>et</strong> l’utilisateur <strong>ne peut plus le modifier</strong> (option grisée dans Personnalisation).</li>
  </ol>`),
  html(cmd('gpupdate /force        puis :  déconnexion → reconnexion')),

  h2('8) Exemple 3 — déployer un logiciel (.msi) par GPO'),
  html(`<p><strong>Objectif :</strong> installer automatiquement <strong>7-Zip</strong> sur des postes sans passer machine par machine. On <strong>attribue</strong> le paquet <code>.msi</code> aux <strong>ordinateurs</strong> (installation au démarrage). La GPO d’installation logicielle n’accepte que le format <strong>MSI</strong> (pour un <code>.exe</code>, il faut un outil tiers ou un script).</p>`),
  note('yellow', '📌 Le .msi doit être sur un partage lisible par les ORDINATEURS', `<p>Comme on cible la <strong>Configuration ordinateur</strong>, c’est le <strong>compte machine</strong> qui lit le paquet au démarrage. Dépose le <code>.msi</code> sur un <strong>partage dédié aux ressources GPO</strong> et donne le droit de <strong>lecture</strong> à <strong>${hl('Utilisateurs authentifiés')}</strong> — ce groupe inclut à la fois les <em>machines</em> et les <em>utilisateurs</em> (ou utilise <em>Ordinateurs du domaine</em>). Toujours un chemin <strong>UNC</strong> (ex. <span class="gpo-path">${UNC_MSI}</span>), <strong>jamais</strong> un chemin local <code>C:\\…</code> (le client ne le verrait pas).</p>`),

  h3('Étape 1 — Créer la GPO'),
  html(win('Nouvel objet GPO', `<div class="gpo-kv"><span class="lb">Nom :</span><span class="gpo-fld">${hl('deploiement 7zip ordinateur')}</span><span class="lb">Objet Starter GPO source :</span><span class="gpo-fld">(aucun)</span></div>`)),
  html(`<p>Clic droit sur l’OU (ou le domaine) → <strong>Créer un objet GPO dans ce domaine, et le lier ici</strong>, la nommer, puis <strong>Modifier</strong>.</p>`),

  h3('Étape 2 — Ajouter le paquet'),
  html(`<p>Dérouler <span class="gpo-path">Configuration ordinateur → Stratégies → Paramètres du logiciel → ${hl('Installation de logiciel')}</span>. Clic droit → <strong>Nouveau → Package…</strong>, puis sélectionner le <code>.msi</code> <strong>par son chemin UNC</strong>.</p>`),
  html(win('Déploiement du logiciel — type de déploiement', `<div style="font-size:13px;line-height:2">
    ◯ Publié &nbsp;<span style="color:var(--text-muted)">(grisé en Configuration ordinateur — réservé aux utilisateurs)</span><br>
    ◉ ${hl('Attribué')} &nbsp;— assigner l’application sans modification<br>
    ◯ Avancé &nbsp;<span style="color:var(--text-muted)">(catégories, transformations .mst…)</span>
  </div>`)),
  tbl(['Type', 'Effet'], [
    ['Attribué (ordinateur)', 'Installé <strong>automatiquement au démarrage</strong> du poste, pour tous les utilisateurs.'],
    ['Attribué (utilisateur)', 'Installé/proposé à l’<strong>ouverture de session</strong> de l’utilisateur.'],
    ['Publié (utilisateur uniquement)', 'Installation <strong>facultative</strong> via « Programmes et fonctionnalités ».'],
  ]),

  h3('Étape 3 — Options de déploiement'),
  html(`<p>Double-cliquer sur le paquet → onglet <strong>Déploiement</strong> pour affiner :</p>`),
  html(win('Propriétés de 7-Zip 25.01 (x64) — onglet « Déploiement »', `<div style="font-size:13px;line-height:2">
    Type de déploiement : ◉ ${hl('Attribué')}<br>
    ☑ Installer automatiquement en activant l’extension de fichier<br>
    ☐ Désinstaller l’application quand elle sort de l’étendue de gestion<br>
    ☐ ${hl('Installer cette application lors de l’ouverture de session')}
  </div>`)),
  note('green', '💡 Notes du document', `<p>Choisir <strong>Attribué</strong> débloque l’option « <strong>Installer cette application lors de l’ouverture de session</strong> » (installation immédiate à la connexion, au lieu d’attendre le 1er usage). Cocher « <strong>Désinstaller quand hors de l’étendue</strong> » fait <strong>partir</strong> le logiciel si le poste quitte l’OU — utile pour garder un parc propre.</p>`),

  h3('Étape 4 — Valider et appliquer'),
  html(`<ul class="gpo-steps">
    <li><strong>Fermer l’éditeur</strong> de GPO pour <strong>valider</strong> l’ajout du paquet.</li>
    <li>Sur le poste : <code>gpupdate /force</code> puis <strong>redémarrer</strong> (une appli attribuée à l’ordinateur s’installe <strong>au démarrage</strong>).</li>
    <li>Vérifier la présence du logiciel (menu Démarrer / <code>Programmes et fonctionnalités</code>).</li>
  </ul>`),
  html(cmd('gpupdate /force        puis :  redémarrer le poste (installation au boot)')),

  h2('9) Vérifier & dépanner une GPO'),
  tbl(['Commande / outil', 'Usage'], [
    ['<code>gpupdate /force</code>', 'Recharge immédiatement toutes les stratégies (ordinateur + utilisateur).'],
    ['<code>gpresult /r</code>', 'Liste les GPO <strong>réellement appliquées</strong> à l’utilisateur/l’ordinateur (et celles filtrées).'],
    ['<code>gpresult /h rapport.html</code>', 'Génère un rapport HTML complet de résolution des stratégies (RSoP).'],
    ['<code>rsop.msc</code>', 'Console graphique « Jeu de stratégie résultant » sur le poste.'],
    ['GPMC → Résultats de stratégie', 'Interroger à distance ce qui s’applique à un couple utilisateur+ordinateur.'],
    ['GPMC → Modélisation de stratégie', 'Simuler « et si » cet utilisateur était dans cette OU / ce site.'],
  ]),
  note('yellow', '🔧 Ça ne s’applique pas ? Vérifie…', `<p>1) la GPO est <strong>liée</strong> à la bonne OU et le <strong>lien est activé</strong> ; 2) l’objet (utilisateur/ordinateur) est bien <strong>dans</strong> cette OU ; 3) le <strong>filtrage de sécurité</strong> inclut l’utilisateur/le groupe ; 4) bonne moitié (ordinateur vs <strong>utilisateur</strong>) ; 5) attendre le rafraîchissement ou faire <code>gpupdate /force</code> ; 6) pas de <strong>blocage d’héritage</strong> au-dessus ; 7) pour un partage : le <strong>chemin UNC</strong> est correct et l’utilisateur a les <strong>droits NTFS/Partage</strong> (voir <a href="/pages/permissions-partage-ntfs">Partage &amp; NTFS</a>).</p>`),

  h2('10) Cas d’usage courants'),
  tbl(['Besoin', 'Où / comment'], [
    ['Politique de mot de passe', 'Configuration ordinateur → Stratégies → Paramètres Windows → Stratégies de comptes (au niveau <strong>domaine</strong>).'],
    ['Lecteur réseau', 'Configuration utilisateur → Préférences → Mappages de lecteurs (l’exemple ci-dessus).'],
    ['Imprimante réseau', 'Configuration utilisateur → Préférences → Paramètres du Panneau de configuration → Imprimantes.'],
    ['Fond d’écran imposé', 'Configuration utilisateur → Stratégies → Modèles d’administration → Bureau.'],
    ['Bloquer le Panneau de configuration', 'Configuration utilisateur → Modèles d’administration → Panneau de configuration.'],
    ['Bloquer l’invite de commandes (cmd)', 'Configuration utilisateur → Modèles d’administration → Système → « Empêcher l’accès à l’invite de commandes » (voir la méthode détaillée dans le TP, §11).'],
    ['Déployer un logiciel (.msi)', 'Configuration ordinateur → Stratégies → Paramètres du logiciel → Installation de logiciel (paquet <strong>MSI</strong>, type <strong>Attribué</strong>) — voir l’exemple 3.'],
    ['Autoriser le ping (ICMP)', 'Configuration ordinateur → Pare-feu Windows Defender avec sécurité avancée (voir <a href="/pages/astuce-pare-feu-ping">l’astuce</a>).'],
  ]),

  h2('11) TP guidé — héritage, ciblage par groupe & lien vs objet'),
  html(`<p>Un TP « stratégies de groupe » sur le domaine <strong>ADRAR.LAN</strong> : une arborescence d’<strong>OU régionales</strong>, un <strong>groupe</strong> et un <strong>utilisateur</strong> par OU, et une arborescence de <strong>dossiers partagés</strong> qui la reflète. On y met en pratique le <strong>ciblage par groupe</strong>, le <strong>blocage d’héritage</strong> et la différence <strong>lien ≠ objet</strong>.</p>`),
  html(win('Utilisateurs et ordinateurs Active Directory — ADRAR.LAN', `<div class="gpo-tree">📁 ADRAR.LAN
 └─ 📁 1-UO_Sud Ouest            👥 G_sud-ouest · 👤 Michael Scott
     ├─ 📁 Nouvelle Aquitaine    👥 G_nouvelle_aquitaine · 👤 Jim Alpert
     └─ 📁 ${hl('Occitanie')}             👥 G_occitanie · 👤 Dwight Schrute
         ├─ 📁 Perpignan         👥 G_perpignan · 👤 Andy Bernard
         └─ 📁 Toulouse          👥 G_toulouse · 👤 Pam Beesly</div>`)),
  html(win('Dossiers partagés (E:) — sécurisés par NTFS', `<div class="gpo-tree">💾 Fichiers (E:)
 └─ 📁 Sud-Ouest              partage → ${S}\\Sud-Ouest
     ├─ 📁 NouvelleAquitaine
     └─ 📁 Occitanie
         ├─ 📁 Perpignan
         └─ 📁 Toulouse</div>`)),

  h3('Les GPO à créer'),
  html(`<p><strong>Sur les utilisateurs :</strong></p>
  <ul class="gpo-steps">
    <li><strong>3 lecteurs réseau</strong> (préférences), chacun <strong>ciblé sur un/des groupe(s)</strong> — voir le tableau ci-dessous.</li>
    <li><strong>Bloquer l’invite de commandes</strong> pour les utilisateurs d’<strong>Occitanie</strong>.</li>
  </ul>
  <p><strong>Sur les ordinateurs :</strong></p>
  <ul class="gpo-steps">
    <li><strong>Nouvelle</strong> GPO de <strong>politique de mot de passe</strong> : longueur minimale <strong>9 caractères</strong> (une GPO mot de passe existe déjà — la <em>Default Domain Policy</em> — on en crée une <strong>nouvelle</strong>).</li>
    <li><strong>Déployer 7-Zip</strong> sur tous les ordinateurs (voir §8).</li>
  </ul>`),

  h3('Ciblage d’élément par groupe (item-level targeting)'),
  html(`<p>Un <strong>seul</strong> GPO « Lecteurs » peut contenir <strong>plusieurs</strong> mappages, chacun visible <strong>uniquement</strong> par le bon groupe. Dans chaque mappage : onglet <strong>Commun</strong> → ☑ <strong>Ciblage au niveau de l’élément</strong> → <strong>Ciblage…</strong> → <em>Nouvel élément</em> → <strong>Groupe de sécurité</strong> → choisir le groupe.</p>`),
  html(tbl(['Lecteur (dossier)', 'Chemin UNC', 'Ciblage — visible par'], [
    ['Sud-Ouest', `${S}\\Sud-Ouest`, '<strong>tous</strong> les utilisateurs (aucun ciblage)'],
    ['Occitanie', `${S}\\Sud-Ouest\\Occitanie`, 'G_Occitanie <strong>ou</strong> G_Toulouse <strong>ou</strong> G_Perpignan'],
    ['Toulouse', `${S}\\Sud-Ouest\\Occitanie\\Toulouse`, 'G_Toulouse uniquement'],
  ])),
  note('yellow', '⚠️ Ciblage ≠ droits d’accès', `<p>Le ciblage décide <strong>qui voit le lecteur</strong>. L’<strong>accès au contenu</strong> dépend, lui, des <strong>droits NTFS</strong> du dossier. Un lecteur ciblé mais sans droit NTFS → il apparaît mais reste inaccessible.</p>`),

  h3('Méthode — bloquer l’invite de commandes'),
  html(`<ol class="gpo-steps">
    <li>Créer/lier une GPO à l’OU <strong>Occitanie</strong> (ex. <strong>GPO_Bloquer_CMD</strong>), puis <strong>Modifier</strong>.</li>
    <li>Aller à : <span class="gpo-path">Configuration utilisateur → Stratégies → Modèles d’administration → Système</span>.</li>
    <li>Double-cliquer sur <strong>Empêcher l’accès à l’invite de commandes</strong> → <strong>Activé</strong>.</li>
  </ol>`),
  html(win('Empêcher l’accès à l’invite de commandes', `<div class="gpo-kv">
    <span class="lb">État :</span><span>◉ ${hl('Activé')}</span>
    <span class="lb">Options :</span><span>Désactiver aussi le traitement des scripts de commande : <span class="gpo-fld">${hl('Non')}</span></span>
  </div>`)),
  note('blue', '💡 L’option « scripts de commande »', `<p>Laisse « <strong>Désactiver aussi le traitement des scripts</strong> » sur <strong>Non</strong> : sinon tu bloques aussi les <strong>scripts de connexion</strong> (.bat/.cmd) et certaines tâches. À l’ouverture de <code>cmd.exe</code>, l’utilisateur voit alors : « <em>L’invite de commandes a été désactivée par votre administrateur</em> ». (Astuce examen : PowerShell se bloque séparément — <span class="gpo-path">…→ Windows PowerShell</span>.)</p>`),

  h3('Méthode — nouvelle GPO de mot de passe (9 caractères)'),
  html(`<p>La politique de mot de passe est une stratégie <strong>« ordinateur »</strong> qui s’applique au <strong>domaine</strong>. Créer une <strong>nouvelle</strong> GPO liée au domaine puis : <span class="gpo-path">Configuration ordinateur → Stratégies → Paramètres Windows → Paramètres de sécurité → Stratégies de comptes → Stratégie de mot de passe</span> → <strong>Longueur minimale du mot de passe = 9</strong>.</p>`),
  tbl(['Paramètre', 'Rôle'], [
    ['Longueur minimale', 'Nombre minimal de caractères (ici <strong>9</strong>).'],
    ['Le mot de passe doit respecter des exigences de complexité', 'Impose au moins 3 catégories : majuscule, minuscule, chiffre, symbole.'],
    ['Durée de vie max / min', 'Validité d’un mot de passe / délai avant de pouvoir le changer.'],
    ['Conserver l’historique', 'Empêche de réutiliser les N derniers mots de passe.'],
    ['Verrouillage du compte', 'Nombre de tentatives échouées avant blocage (stratégie de verrouillage).'],
  ]),

  h3('Ce que le TP démontre'),
  html(`<p><strong>① Héritage &amp; blocage.</strong> Les utilisateurs d’une OU reçoivent les GPO liées <strong>au-dessus</strong> (domaine, OU parentes). <strong>Bloquer l’héritage</strong> sur une OU (clic droit → <em>Bloquer l’héritage</em>, repérée par l’icône <strong>!</strong> bleue) coupe ces GPO héritées :</p>
  <ul class="gpo-steps">
    <li>Blocage sur <strong>Occitanie</strong> → ses utilisateurs <strong>perdent</strong> le lecteur <em>Sud-Ouest</em> hérité du dessus ; ils gardent ce qui est lié <strong>à leur niveau ou en dessous</strong> (Pam garde son lecteur <em>Toulouse</em>).</li>
    <li>Blocage sur <strong>Perpignan</strong> → Andy n’a <strong>plus aucun lecteur</strong> (tout venait d’au-dessus).</li>
    <li>Exception : une GPO marquée <strong>Appliqué (Enforced)</strong> <strong>traverse</strong> le blocage.</li>
  </ul>`),
  html(`<p><strong>② Lien ≠ objet (étape « suppression »).</strong> Supprimer la GPO <em>7-Zip</em> <strong>depuis l’OU</strong> propose « <strong>Supprimer le lien</strong> » : on n’enlève que le <strong>raccourci</strong>. La GPO est <strong>toujours présente</strong> dans <strong>« Objets de stratégie de groupe »</strong>. Pour la supprimer <strong>réellement</strong> : y aller → clic droit → <strong>Supprimer</strong> (voir la note du §1).</p>`),
  note('green', '🎯 À savoir refaire', `<p>Créer des OU imbriquées + groupes ; mapper des lecteurs <strong>ciblés par groupe</strong> ; <strong>bloquer cmd</strong> ; une <strong>GPO mot de passe</strong> ; <strong>déployer un .msi</strong> ; observer <strong>héritage / blocage / Enforced</strong> ; distinguer <strong>lien</strong> et <strong>objet</strong>. Entraîne le parcours ADUC + GPMC dans le <a href="/pages/simulateur-complet">simulateur complet</a> et suis la <a href="/pages/procedure-gpo">procédure GPO</a>.</p>`),

  h2('12) Bonnes pratiques'),
  html(`<ul class="gpo-steps">
    <li><strong>Lier à une OU</strong>, pas au domaine entier (sauf réglage réellement global comme le mot de passe).</li>
    <li><strong>Nommer clairement</strong> : « Lecteur K_Production », « Verrouillage postes RH »… (on relie souvent des dizaines de GPO).</li>
    <li><strong>Un thème par GPO</strong> : plus facile à activer/désactiver et à dépanner qu’une GPO fourre-tout.</li>
    <li><strong>Tester</strong> sur une OU pilote avant de généraliser ; utiliser <em>Modélisation</em> pour anticiper.</li>
    <li><strong>Cibler par groupe</strong> (filtrage de sécurité / ciblage d’élément) plutôt que multiplier les OU.</li>
    <li><strong>Sauvegarder</strong> les GPO (GPMC → Sauvegarder tout) avant modification importante.</li>
    <li>Éviter de modifier les <strong>Default Domain / Domain Controllers Policy</strong> : créer ses propres GPO.</li>
  </ul>`),

  note('green', '🎓 Passer à la pratique', `<p>Suis la procédure pas-à-pas : <a href="/pages/procedure-gpo">GPO : créer, lier, filtrer, appliquer</a>. Entraîne le <strong>parcours dans l’interface</strong> (ADUC + GPMC) dans le <a href="/pages/simulateur-complet">simulateur complet</a>. Voir aussi : <a href="/pages/administration-domaine-ad">Administration d’un domaine AD</a>, <a href="/pages/vocabulaire-active-directory">Vocabulaire AD</a>, <a href="/pages/permissions-partage-ntfs">Permissions Partage &amp; NTFS</a>.</p>`),
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
  const res = cur
    ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body })
    : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
  console.log('PAGE', PAGE.slug, res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());
  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } });
  console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

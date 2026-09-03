# tssr-webcms

Le site de cours **TSSR** (technicien supérieur systèmes et réseaux), en
production sur `https://tssr.miyukini.com`.

Le moteur est un CMS maison réutilisable (voir plus bas) ; ce dépôt en est
l'instance TSSR, avec tout le contenu pédagogique : cours, procédures, quiz,
glossaire, et un **Atelier Réseau** avec ses simulateurs.

| | |
| --- | --- |
| Process | PM2 `webcms` (`tsx server/index.ts`) |
| Port | 3470, exposé par le tunnel Cloudflare |
| Base | `cms.sqlite` (SQLite, mode WAL) |
| Front | React + Vite · Back : Express + Drizzle |

---

## Deux choses se déploient, et pas de la même façon

C'est la distinction la plus utile à connaître ici, parce que les deux se
confondent facilement.

| Ce qu'on modifie | Comment ça arrive en production |
| --- | --- |
| **Le code** (`client/`, `server/`) | `git push` sur `main`, puis la tâche planifiée `TSSR-WebCMS-AutoUpdate` fait le reste |
| **Le contenu** (pages de cours) | on exécute le script de la page, qui écrit dans la base par l'API |

Autrement dit : **pousser sur GitHub ne publie aucune page**, et publier une page
ne demande aucun commit. Le contenu vit dans `cms.sqlite`, pas dans le dépôt ;
les scripts de `scripts/` en sont la source reproductible.

## Le contenu : les scripts `scripts/seed-*.ts`

Quatre-vingt-quinze scripts, un par page. Chacun décrit sa page en **blocs**
(`makePageBlock`), puis se connecte à l'admin et crée ou met à jour la page.

```bash
cd miyukini-cms
BASE=https://tssr.miyukini.com ADMIN_PW='…' npx tsx scripts/seed-procedure-vlan.ts
```

- `BASE` — le site visé. Par défaut `https://tssr.miyukini.com`, donc **la
  production** : pense à le pointer sur `http://localhost:3470` pour essayer.
- `ADMIN_PW` — le mot de passe du compte `admin`. Sans lui, le script s'arrête
  sur `login 401`.

Le script est **idempotent** : il met à jour la page si le `slug` existe déjà,
la crée sinon, puis vide le cache du serveur. On peut donc le relancer autant de
fois qu'on veut, et c'est le mode de travail normal — on édite le script, on
relance, on recharge la page.

> ⚠️ `npm run seed` est **autre chose** : c'est le contenu neutre de démarrage du
> CMS (`server/db/seed.ts`), utile pour un nouveau projet. Il n'a rien à voir avec
> les pages TSSR, et le lancer sur la production n'est pas ce qu'on veut.

### Écrire ou modifier une page

1. Repérer le script — le nom suit le `slug` : `/pages/les-vlan` →
   `scripts/seed-cours-vlan.ts`.
2. L'éditer. Les briques disponibles : `block('heading' | 'html' | 'hero', …)`,
   plus les aides locales définies en tête de chaque script (`cmd()` pour un bloc
   de commandes, `flow()` pour un schéma en monospace, `note()` pour un encadré,
   `check()` pour un point de contrôle).
3. Vérifier la syntaxe sans rien publier :
   `./node_modules/.bin/esbuild scripts/le-script.ts --outfile=/tmp/v.js`
4. Publier avec la commande ci-dessus.
5. Commiter le script — c'est lui qui garde l'historique du contenu.

Les schémas en `flow()` sont rendus en chasse fixe : **une bordure décalée d'un
caractère se voit**. Mieux vaut les construire à partir des colonnes que les
aligner à l'œil.

## Développement

```bash
npm install
npm run dev          # client + serveur en parallèle
npm run typecheck
npm run test
npm run build        # build du front
pm2 restart webcms   # après modification du code serveur
```

## Accès initial

- Utilisateur : `admin`
- Mot de passe : `changeme` (à changer, ainsi que `SESSION_SECRET`, avant toute
  mise en production)

## Variables d'environnement

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `3460` | Port d'écoute Express |
| `SESSION_SECRET` | `dev-session-secret` | Secret de session (**à changer en prod**) |
| `CMS_ADMIN_USER` | `admin` | Identifiant admin |
| `CMS_ADMIN_PASSWORD` | `changeme` | Mot de passe admin (**à changer en prod**) |
| `PUBLIC_BASE_URL` | `https://example.com` | URL publique (liens absolus, OG/SEO, adresse gravée dans l'archive hors-ligne) |
| `CMS_EXPORT_TOKEN` | — | Jeton d'export machine-à-machine (`npm run pull:content` depuis une autre instance) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | — | Envoi d'emails transactionnels |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLIC_KEY` | — | Paiement boutique (optionnel) |

En production, le serveur refuse de démarrer si `SESSION_SECRET` ou
`CMS_ADMIN_PASSWORD` ne sont pas définis.

## Le site hors-ligne, pour les élèves

Le menu public porte un bouton **💾 Hors-ligne**. Il propose l'**exécutable
Windows** — un seul fichier, moteur Node compris, rien à installer — et à défaut
l'archive `.zip`, qui tourne partout mais demande Node.js.

| Paquet | Pour qui | Poids | Prérequis |
| --- | --- | --- | --- |
| `TSSR-Site-hors-ligne.exe` | Windows x64 | ~69 Mo | aucun |
| `tssr-site-hors-ligne.zip` | Windows, Linux, macOS | ~31 Mo | Node.js 22+ |
| `tssr-contenu.zip` | — | ~13 Mo | ce que rechargent les metteurs à jour |

L'exécutable est produit par `scripts/build-exe.mjs` (`npm run build:exe`), qui
empaquette le runtime avec [@yao-pkg/pkg](https://github.com/yao-pkg/pkg). Un
paquet est en lecture seule, or le CMS écrit : au premier lancement, l'exe
dépose base, médias, front et module natif dans un dossier **`TSSR-donnees`** à
côté de lui — une clé USB emporte donc le site *et* son contenu. Options :
`--maj` (recharge le contenu depuis le site), `--port`, `--donnees`, `--aide`.

Deux pièges valent d'être connus, ils ont coûté un aller-retour chacun :
`fs.cpSync` et `fs.copyFileSync` **ne lisent pas** le système de fichiers
virtuel du paquet (`ENOENT: lstat C:\snapshot\…`) — d'où la copie manuelle par
`readdirSync` + `readFileSync` ; et le module SQLite natif ne peut pas être
chargé depuis ce même système virtuel, d'où l'option `nativeBinding` de
better-sqlite3, à qui l'on donne le chemin du binaire déposé sur le disque.

L'ABI du binaire natif doit s'accorder à la cible pkg (`EXE_CIBLE`, défaut
`node22-win-x64` → ABI 127) : le script refuse de construire s'il ne trouve pas
le bon. `@yao-pkg/pkg` est une dépendance de développement ; là où elle manque,
le bouton retombe simplement sur le `.zip`.

| | |
| --- | --- |
| Bouton | `client/src/components/TelechargerHorsLigne.tsx`, posé dans `PublicLayout` |
| Fabrication | `server/lib/hors-ligne.ts` → `scripts/build-portable.mjs` |
| Exécutable | `scripts/build-exe.mjs` + `scripts/portable/exe.cjs` (lanceur) |
| Publication | `scripts/publier-hors-ligne.mts` → release GitHub, tag `hors-ligne` |
| Routes | `GET /api/public/hors-ligne/{infos,exe,site,contenu}` |
| Cache | `export/hors-ligne/` — refait quand la base, son WAL ou `dist/` bougent |

**Le serveur ne fabrique plus l'archive à la demande.** Servir 31 Mo par le
tunnel prenait deux minutes, et refaire le paquet à chaque clic n'avait pas de
sens. La tâche planifiée **`TSSR-WebCMS-PublicationHorsLigne`** construit les
deux archives chaque jour à **8 h** (heure de la machine, réglée sur Paris) et
les dépose sur la release GitHub ; `/site` et `/contenu` ne font plus que
rediriger vers le CDN. Si rien n'a changé depuis la veille, rien n'est déposé.

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-publication-hors-ligne.ps1   # une fois
powershell -ExecutionPolicy Bypass -File scripts\publier-hors-ligne.ps1 -Force        # à la main
```

Journal : `logs/publication-hors-ligne.log`. Le manifeste lu par le serveur est
`export/hors-ligne/publication.json` ; **s'il est absent, le serveur retombe sur
la fabrication à la demande** — c'est le filet, pas le régime normal. La
publication demande un `gh` authentifié (scope `repo`).

Les noms des fichiers déposés sont **fixes** (`tssr-site-hors-ligne.zip`,
`tssr-contenu.zip`) : les archives déjà distribuées reviennent à cette adresse
pour se mettre à jour, elle ne doit pas changer d'un jour à l'autre.

Dans l'archive : `Lancer-le-site.bat` (**Node.js 22+** — better-sqlite3 12.x ne
publie plus rien pour Node 20) et **`Mettre-a-jour.bat`**, qui recharge cours et
médias depuis `PUBLIC_BASE_URL` sans toucher au programme ni aux comptes.
L'ancienne base est sauvegardée avant remplacement ; le site doit être arrêté
pendant l'opération.

Le module SQLite est natif : un binaire par ABI Node et par système. L'archive
en embarque **16** (ABI 127/137/141/147 × win32-x64, linux-x64, darwin-x64,
darwin-arm64) et `demarrer.mjs` pose le bon au lancement. `PORTABLE_CIBLES` et
`PORTABLE_ABIS` retaillent la couverture — et donc le poids.

**La base embarquée est assainie** : comptes, sessions, commandes, écrits du
forum, fichiers des membres et réglages sensibles (mot de passe du site privé,
SMTP, Stripe) sont retirés — ces archives sont publiques. La liste vit dans
`TABLES_VIDEES` / `REGLAGE_SENSIBLE` : **une nouvelle table portant des données
personnelles doit y être ajoutée.** Un compte `admin` / `admin` est créé au
premier lancement de la copie, puisqu'elle n'en contient aucun.

Le bouton s'efface là où le serveur ne sait pas fabriquer l'archive — c'est le
cas d'une copie hors-ligne, qui ne se recopie donc pas elle-même.

## Le moteur, hors TSSR

Le CMS lui-même est neutre et se duplique pour un autre projet :

- CRUD Pages (avec page builder en blocs), Menu, Produits / boutique
- Formulaires de devis, vitrine publique, back-office `/admin`
- Thème et branding éditables (nom de marque, logo, couleurs)

Pour repartir d'une base vierge : copier le dossier sans `cms.sqlite*`,
`node_modules`, `dist` ni `uploads`, puis `npm install`, `npm run seed`, et
personnaliser dans **Admin → Thème**.

## Mise à jour automatique

La tâche planifiée Windows `TSSR-WebCMS-AutoUpdate` exécute
`scripts/auto-update.ps1` toutes les deux heures. Elle est volontairement timide :
elle refuse d'agir si l'arbre de travail est modifié, ou si l'historique local est
en avance ou divergent.

**Conséquence pratique : une modification du code n'est déployée que si elle est
commitée *et* poussée sur `origin/main`.** Un commit local non poussé bloque le
mécanisme (`SKIP : historique divergent`). Journal : `logs/auto-update.log`.

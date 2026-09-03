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

Le menu public porte un bouton **💾 Hors-ligne** : il télécharge le site entier
en un `.zip` qui tourne sans Internet, avec son propre metteur à jour.

| | |
| --- | --- |
| Bouton | `client/src/components/TelechargerHorsLigne.tsx`, posé dans `PublicLayout` |
| Fabrication | `server/lib/hors-ligne.ts` → `scripts/build-portable.mjs` |
| Routes | `GET /api/public/hors-ligne/{infos,site,contenu}` |
| Cache | `export/hors-ligne/` — refait quand la base ou `dist/` bougent |

Dans l'archive : `Lancer-le-site.bat` (Node.js 20+ requis) et
**`Mettre-a-jour.bat`**, qui recharge cours et médias depuis `PUBLIC_BASE_URL`
sans toucher au programme ni aux comptes. L'ancienne base est sauvegardée avant
remplacement ; le site doit être arrêté pendant l'opération.

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

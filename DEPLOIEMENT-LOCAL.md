# Héberger le CMS en local (hors-ligne) sur un poste

Objectif : faire tourner le site sur un poste (ex. à l'école) et y accéder via le
navigateur **sans connexion Internet**. Le CMS est une appli **Node.js + SQLite**
autonome : tout (pages, cours, schémas) vit dans un seul fichier `cms.sqlite`.

> ℹ️ Seul vrai besoin d'Internet : **télécharger Node.js et les dépendances** une
> première fois. Ensuite, tout fonctionne hors-ligne. (Les liens externes des cours
> — Microsoft Learn, YouTube — ne s'ouvriront évidemment pas sans réseau, mais la
> navigation, l'admin et les schémas marchent.)

---

## 1. Prérequis (une seule fois, avec Internet)

1. Installer **Node.js LTS 20+** (testé en 22) : https://nodejs.org
   - Vérifier : `node -v` et `npm -v`.
2. Récupérer le dossier du projet (`miyukini-cms`) sur le poste.

---

## 2. Mise en route (le plus simple — Node seul)

Dans un terminal, à la racine de `miyukini-cms` :

```bash
npm install          # installe les dépendances (better-sqlite3 a un binaire précompilé)
npm run build        # génère le front dans dist/  (à refaire après toute modif du front)

# Choisir le contenu de départ (voir §3) :
#   - soit copier un cms.sqlite existant
#   - soit créer une base de démo neutre :
npm run seed

npm run start:local  # démarre en mode local HTTP
```

Puis ouvrir **http://localhost:3460** dans le navigateur.
Back-office : **http://localhost:3460/admin**.

`start:local` règle automatiquement le mode local (`SERVE_STATIC=1`, cookie non-Secure,
pas de HTTPS requis). Pour personnaliser (port, secret, mot de passe), copier
`.env.example` en **`.env.local`** et adapter les valeurs (chargé automatiquement).

---

## 3. Quel contenu ? (base de données)

Le contenu = le fichier **`cms.sqlite`** à la racine.

- **Garder le contenu actuel** (toutes les pages de cours déjà créées) :
  copier sur le poste les fichiers **`cms.sqlite`** (+ éventuellement `cms.sqlite-wal`,
  `cms.sqlite-shm`) et le dossier **`uploads/`**. Le mot de passe admin est alors
  celui déjà enregistré dans cette base.
- **Repartir d'une base neuve** : ne pas copier `cms.sqlite`, lancer `npm run seed`.
  L'admin est créé avec `CMS_ADMIN_USER` / `CMS_ADMIN_PASSWORD` (voir `.env.local`,
  défaut `admin` / `changeme`).

---

## 4. Démarrage automatique (le site tourne en permanence)

Pour que le CMS redémarre tout seul (au boot, après plantage) :

**Option A — PM2** (déjà utilisé sur le serveur de prod) :
```bash
npm install -g pm2
cross-env NODE_ENV=development SERVE_STATIC=1 PORT=3460 pm2 start node_modules/tsx/dist/cli.mjs --name cms-local -- server/index.ts
pm2 save
pm2 startup     # suivre l'instruction affichée pour le lancement au démarrage
```

**Option B — Tâche planifiée Windows** : créer une tâche « Au démarrage » qui exécute
`npm run start:local` dans le dossier du projet.

---

## 5. (Optionnel) Servir via IIS sur le port 80

Si tu veux y accéder en **http://localhost** (sans `:3460`) ou depuis d'autres postes
du réseau via le nom de la machine, mets **IIS en reverse proxy** devant Node :

1. Installer **URL Rewrite** et **Application Request Routing (ARR)** (liens dans
   `deploy/iis/web.config`).
2. Dans IIS Manager → serveur → *ARR* → *Server Proxy Settings* → cocher **Enable proxy**.
3. Créer un site IIS pointant sur un dossier vide et y copier **`deploy/iis/web.config`**.
4. Garder le CMS Node lancé en parallèle (§4) sur le port 3460.

> IIS **ne fait pas tourner Node** lui-même ici : il ne fait que relayer les requêtes
> vers l'appli Node (approche fiable, qui évite les soucis de module natif `better-sqlite3`
> avec `iisnode`).

---

## Variables utiles (`.env.local`)

| Variable | Local conseillé | Rôle |
|---|---|---|
| `NODE_ENV` | `development` | Évite l'exigence de secrets et le cookie Secure |
| `SERVE_STATIC` | `1` | Sert le front buildé (`dist`) depuis Express |
| `COOKIE_SECURE` | `0` | Cookie de session sans HTTPS (sinon login admin KO) |
| `PORT` | `3460` | Port d'écoute → `http://localhost:PORT` |
| `PUBLIC_BASE_URL` | `http://localhost:3460` | Liens absolus / SEO |
| `CMS_ADMIN_USER` / `CMS_ADMIN_PASSWORD` | `admin` / *(au choix)* | Admin créé par `npm run seed` |
| `SESSION_SECRET` | *(aléatoire)* | Secret de session |

---

## Dépannage

- **La connexion admin « ne tient pas » / boucle** → cookie `Secure` actif en HTTP :
  vérifier `COOKIE_SECURE=0` (ou lancer via `npm run start:local`).
- **Page blanche / 404 sur tout** → front non buildé : `npm run build`.
- **« dist/client manquant »** dans les logs → idem, lancer `npm run build`.
- **Port déjà utilisé** → changer `PORT` dans `.env.local`.
- **Polices un peu différentes hors-ligne** → normal : les polices Google ne sont pas
  téléchargées, le navigateur utilise des polices système (texte lisible immédiatement).
  On peut auto-héberger les polices si besoin (demande dédiée).
```

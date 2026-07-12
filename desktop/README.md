# TSSR — version locale (application de bureau)

Application **Electron** qui affiche le site TSSR dans **sa propre fenêtre** (pas de navigateur à ouvrir), **hors-ligne**, avec **mise à jour** du contenu depuis le site en ligne.

## Comment ça marche

- Au lancement, l'app **synchronise** le contenu public depuis `https://tssr.miyukini.com` (pages, images, menus, thème) et le met en **cache local** (dossier profil utilisateur). Si Internet n'est pas disponible, elle utilise le **cache existant**.
- Un **mini-serveur local** (`127.0.0.1`, sans module natif) sert le SPA déjà construit (`dist/client`) et le contenu en cache en imitant l'API publique.
- Les **outils interactifs** (Atelier Réseau, convertisseur hexadécimal, etc.) fonctionnent : ce sont des composants côté client, embarqués dans le SPA.
- Menu **Fichier → Mettre à jour le contenu** (`Ctrl+U`) pour resynchroniser quand vous avez Internet.

Aucune donnée sensible n'est embarquée : seul le **contenu public** est mis en cache (pas d'accès admin, pas de base SQLite du serveur).

## Construire l'exécutable (.exe) — sur une machine Windows

Prérequis : **Node.js 18+**.

```bat
:: 1) Construire le SPA (depuis la racine du dépôt)
cd ..
npm install
npm run build

:: 2) Construire l'application de bureau
cd desktop
npm install
npm run dist
```

Résultat dans `desktop/out/` :
- `TSSR-Local-1.0.0-portable.exe` — **portable** (double-clic, rien à installer)
- `TSSR-Local-Setup-1.0.0.exe` — **installateur** (crée un raccourci « TSSR Local »)

## Développement / test rapide (sans empaqueter)

```bat
:: le SPA doit être construit (../dist/client)
cd desktop
npm install
npm run sync     :: teste la synchro (remplit ./cache)
npm run serve    :: teste le miroir sur http://127.0.0.1:4599
npm start        :: lance la fenêtre Electron
```

## Personnalisation

- **Source du contenu** : variable d'environnement `TSSR_LIVE` (défaut `https://tssr.miyukini.com`).
- **Emplacement du cache** : `TSSR_CACHE` (défaut : profil utilisateur en mode app, `./cache` en mode script).

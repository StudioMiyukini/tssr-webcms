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

:: 2) Application de bureau
cd desktop
npm install
npm run seed        :: (optionnel) pré-embarque le contenu pour un 1er lancement hors-ligne
npm run dist        :: exécutable portable + installateur
```

Résultat dans `desktop/out/` :
- `TSSR-Local-1.0.0-portable.exe` — **portable** (double-clic, rien à installer)
- `TSSR-Local-Setup-1.0.0.exe` — **installateur** (crée un raccourci « TSSR Local »)

### ⚠️ Si `npm run dist` échoue (« Cannot create symbolic link »)

C'est une limite Windows : `electron-builder` a besoin du privilège de **liens symboliques** pour préparer la signature. Deux solutions :

1. **Activer le Mode développeur** : Paramètres → *Confidentialité et sécurité* → *Espace développeurs* → activer. Puis relancer `npm run dist`.
2. Ou lancer le terminal **en tant qu'administrateur**, puis `npm run dist`.

**Sans** ce privilège, utilisez la variante **dossier exécutable** (ne signe pas, donc pas de blocage) :

```bat
npx electron-builder --win dir
```

→ produit `desktop/out/win-unpacked/` : un dossier contenant **`TSSR Local.exe`** (double-clic pour lancer). Copiez/zippez ce dossier pour le transporter — c'est une app complète et autonome (~270 Mo).

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

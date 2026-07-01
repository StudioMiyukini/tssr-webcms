# Web CMS

CMS/mini WordPress maison, réutilisable et neutre. À dupliquer pour démarrer un nouveau projet.

Fonctions :
- CRUD Pages (+ page builder en blocs)
- CRUD Menu
- CRUD Produits / boutique en ligne
- Formulaires de devis
- Vitrine publique + back-office `/admin`
- Thème & branding éditables (nom de marque, logo, couleurs)

## Accès initial
- Utilisateur : `admin`
- Mot de passe : `changeme`

> ⚠️ Change le mot de passe et `SESSION_SECRET` avant toute mise en production
> (via variables d'environnement ou `ecosystem.config.cjs`).

## Lancement
```bash
npm install
npm run seed     # contenu de démarrage neutre (page accueil, à-propos, démo boutique)
npm start
```

Port par défaut : `3460`

## Dupliquer pour un nouveau projet
1. Copier le dossier (sans `cms.sqlite*`, `node_modules`, `dist`, `uploads`).
2. `npm install` puis `npm run seed`.
3. Personnaliser le branding dans **Admin → Thème** (nom de marque, logo, favicon, couleurs).
4. Définir les variables d'environnement : `SESSION_SECRET`, `CMS_ADMIN_PASSWORD`, `PUBLIC_BASE_URL`, et le SMTP si besoin.

## Variables d'environnement
| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `3460` | Port d'écoute Express |
| `SESSION_SECRET` | `dev-session-secret` | Secret de session (**à changer en prod**) |
| `CMS_ADMIN_USER` | `admin` | Identifiant admin |
| `CMS_ADMIN_PASSWORD` | `changeme` | Mot de passe admin (**à changer en prod**) |
| `PUBLIC_BASE_URL` | `https://example.com` | URL publique (liens absolus, OG/SEO) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | — | Envoi d'emails transactionnels |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLIC_KEY` | — | Paiement boutique (optionnel) |

En production, le serveur refuse de démarrer si `SESSION_SECRET` ou `CMS_ADMIN_PASSWORD` ne sont pas définis.

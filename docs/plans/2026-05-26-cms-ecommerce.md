# CMS e-commerce MVP Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Déployer une webapp type CMS/WordPress avec CRUD pages/menu et une base de boutique en ligne.

**Architecture:** Une application Express + SQLite server-rendered pour aller vite sur Windows/PM2, avec interface publique et back-office `/admin`. Les entités de base sont pages, menus, produits et un compte admin local.

**Tech Stack:** Node.js, Express, better-sqlite3, express-session, bcryptjs, PM2, Cloudflare Tunnel.

---

### Task 1: Initialiser le projet
- Créer `package.json`
- Définir `npm start`
- Installer les dépendances runtime

### Task 2: Créer le backend CMS
- Créer `server.mjs`
- Initialiser SQLite au démarrage
- Ajouter login admin + session
- Ajouter CRUD pages/menu/produits
- Ajouter rendu public site + boutique

### Task 3: Déployer le service
- Installer dépendances
- Démarrer via PM2 sous le nom `miyukini-cms`
- Vérifier HTTP local sur le port 3460

### Task 4: Publier
- Ajouter `cms.miyukini-home.org` dans `cloudflared`
- Créer la route DNS du tunnel
- Vérifier publiquement le site

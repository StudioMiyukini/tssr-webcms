/* Application de bureau TSSR (Electron) — fenêtre native, pas de navigateur.
   Au lancement : synchronise le contenu depuis le site en ligne (si connecté),
   sinon utilise le cache. Démarre le mini-serveur miroir en local (127.0.0.1)
   et l'affiche dans la fenêtre. Menu « Mettre à jour » pour resynchroniser. */
'use strict';
const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Cache dans le profil utilisateur ; client servi depuis les ressources empaquetées.
process.env.TSSR_CACHE = path.join(app.getPath('userData'), 'cache');
process.env.TSSR_CLIENT = app.isPackaged
  ? path.join(process.resourcesPath, 'client')
  : path.join(__dirname, '..', 'dist', 'client');

const { createServer } = require('./server');
const sync = require('./sync');

// Premier lancement hors-ligne : recopie le cache pré-embarqué (seed) s'il n'y a rien.
function seedCacheIfEmpty() {
  const pagesDir = path.join(process.env.TSSR_CACHE, 'pages');
  const hasContent = fs.existsSync(pagesDir) && fs.readdirSync(pagesDir).length > 0;
  if (hasContent) return;
  const seed = app.isPackaged ? path.join(process.resourcesPath, 'seed-cache') : path.join(__dirname, 'seed-cache');
  try { if (fs.existsSync(seed)) fs.cpSync(seed, process.env.TSSR_CACHE, { recursive: true }); } catch { /* ignore */ }
}

let win = null;
let port = 0;
let syncing = false;

function startServer() {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.listen(0, '127.0.0.1', () => resolve(srv.address().port));
  });
}

async function runSync() {
  if (syncing) return null;
  syncing = true;
  try { return await sync.sync(() => {}); }
  catch { return null; }
  finally { syncing = false; }
}

async function updateAndReload() {
  if (win) win.setTitle('TSSR — Local (mise à jour…)');
  const r = await runSync();
  if (win) {
    win.webContents.reload();
    win.setTitle('TSSR — Local');
    dialog.showMessageBox(win, {
      type: r ? 'info' : 'warning',
      title: 'Mise à jour',
      message: r ? `Contenu mis à jour : ${r.pages} pages, ${r.images} images.` : 'Hors ligne — le contenu en cache est conservé.',
    });
  }
}

function buildMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'Fichier',
      submenu: [
        { label: 'Mettre à jour le contenu', accelerator: 'CmdOrCtrl+U', click: updateAndReload },
        { label: 'Ouvrir le site en ligne', click: () => shell.openExternal(sync.LIVE) },
        { type: 'separator' },
        { role: 'quit', label: 'Quitter' },
      ],
    },
    {
      label: 'Affichage',
      submenu: [
        { role: 'reload', label: 'Recharger' }, { role: 'togglefullscreen', label: 'Plein écran' },
        { type: 'separator' },
        { role: 'zoomIn', label: 'Zoom +' }, { role: 'zoomOut', label: 'Zoom −' }, { role: 'resetZoom', label: 'Zoom 100 %' },
        { type: 'separator' }, { role: 'toggleDevTools', label: 'Outils de développement' },
      ],
    },
  ]));
}

async function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 900, minHeight: 600,
    title: 'TSSR — Local', backgroundColor: '#0f1115', autoHideMenuBar: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  await win.loadURL(`http://127.0.0.1:${port}`);
  win.on('closed', () => { win = null; });
}

app.whenReady().then(async () => {
  buildMenu();
  seedCacheIfEmpty();       // contenu disponible dès le 1er lancement, même hors-ligne
  await runSync();          // synchro auto au lancement (silencieuse ; ignore si hors-ligne)
  port = await startServer();
  await createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => app.quit());

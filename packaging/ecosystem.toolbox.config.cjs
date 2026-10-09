// PM2 — serveur de téléchargement des paquets + son tunnel dédié.
//   pm2 start packaging/ecosystem.toolbox.cjs && pm2 save
//
// Deux process : le mini serveur (127.0.0.1:3491) et SON tunnel cloudflared
// (toolbox-deb.miyukini.org + toolbox-rpm.miyukini.org). Tunnel DÉDIÉ, comme les
// autres sites, pour ne pas toucher au service partagé.
const CF = 'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe';

module.exports = {
  apps: [
    {
      name: 'toolbox-dl',
      script: 'toolbox-dl.cjs',
      cwd: __dirname,
      interpreter: 'node',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      time: true,
      env: { NODE_ENV: 'production', PORT: '3491' },
    },
    {
      name: 'toolbox-tunnel',
      script: CF,
      args: ['tunnel', '--config', 'C:\\Users\\Van Jean\\.cloudflared\\toolbox-config.yml', 'run'],
      interpreter: 'none',
      autorestart: true,
      restart_delay: 5000,
      time: true,
      env: { TUNNEL_URL: '' },
    },
  ],
};

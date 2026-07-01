/* Active l'« espace membres » : seul l'accueil reste public, le reste exige un compte connecté.
   À lancer APRÈS un redémarrage du serveur (pm2 restart webcms) car le réglage est nouveau côté serveur.
   Usage : BASE=... ADMIN_PW=... tsx scripts/enable-members-only.ts          (active)
           MEMBERS=off ... tsx scripts/enable-members-only.ts                 (désactive) */
const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const ON = (process.env.MEMBERS || 'on').toLowerCase() !== 'off';

function cookieFrom(res: Response): string {
  const sc = (res.headers as any).getSetCookie?.() as string[] | undefined;
  return (sc && sc.length ? sc : [res.headers.get('set-cookie') || '']).map(c => c.split(';')[0]).filter(Boolean).join('; ');
}
async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: PW }) });
  if (!login.ok) throw new Error(`login ${login.status}`);
  const cookie = cookieFrom(login);
  const h = { 'Content-Type': 'application/json', Cookie: cookie };
  const cur = await (await fetch(`${BASE}/api/admin/site`, { headers: { Cookie: cookie } })).json();
  if (!('membersOnly' in cur)) { console.error('⚠ Le serveur ne connaît pas encore « membersOnly » — redémarre-le (pm2 restart webcms) puis relance ce script.'); process.exit(2); }
  const { hasGatePassword, ...site } = cur;
  const res = await fetch(`${BASE}/api/admin/site`, { method: 'PUT', headers: h, body: JSON.stringify({ ...site, membersOnly: ON }) });
  console.log('site PUT', res.status, res.ok ? '' : await res.text());
  const after = await (await fetch(`${BASE}/api/site-access`)).json();
  console.log('site-access →', JSON.stringify(after));
  console.log(ON ? '✅ Espace membres ACTIVÉ (seul l’accueil est public).' : '✅ Espace membres désactivé (site public).');
}
main().catch(e => { console.error(e); process.exit(1); });

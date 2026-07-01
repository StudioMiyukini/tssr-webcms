/* Téléverse les 16 photos de connecteurs (image2..image17) du TP3 dans la bibliothèque de médias.
   Usage : BASE=... ADMIN_PW=... tsx scripts/upload-tp3.ts */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEDIA = path.join(__dirname, 'tp3media', 'word', 'media');

function cookieFrom(res: Response): string {
  const sc = (res.headers as any).getSetCookie?.() as string[] | undefined;
  return (sc && sc.length ? sc : [res.headers.get('set-cookie') || '']).map(c => c.split(';')[0]).filter(Boolean).join('; ');
}

async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: PW }) });
  if (!login.ok) throw new Error(`login ${login.status}`);
  const cookie = cookieFrom(login);
  const h = { 'Content-Type': 'application/json', Cookie: cookie };

  const existing = await (await fetch(`${BASE}/api/admin/media`, { headers: { Cookie: cookie } })).json() as Array<{ original_name: string; url: string }>;
  const done = new Set(existing.map(m => m.original_name));

  const results: string[] = [];
  for (let n = 2; n <= 17; n++) {
    const idx = String(n - 1).padStart(2, '0'); // image2 -> 01 ... image17 -> 16
    const name = `tp3-cm-${idx}.png`;
    if (done.has(name)) { const u = existing.find(m => m.original_name === name)!.url; results.push(`${name} (déjà) ${u}`); continue; }
    const buf = fs.readFileSync(path.join(MEDIA, `image${n}.png`));
    const dataUrl = 'data:image/png;base64,' + buf.toString('base64');
    const up = await fetch(`${BASE}/api/admin/media`, { method: 'POST', headers: h, body: JSON.stringify({ filename: name, dataUrl }) });
    if (!up.ok) { results.push(`${name} ÉCHEC ${up.status} ${await up.text()}`); continue; }
    const m = await up.json() as { url: string };
    results.push(`${name} -> ${m.url}`);
  }
  console.log(results.join('\n'));
  console.log(`\nTotal: ${results.length} fichiers.`);
}
main().catch(e => { console.error(e); process.exit(1); });

/* Cours « La messagerie (mail) ». Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cours-messagerie.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = { slug: 'la-messagerie', title: 'La messagerie électronique (mail)', excerpt: 'Comprendre le fonctionnement du courrier électronique : les protocoles SMTP (envoi), POP3 et IMAP (réception), le rôle du DNS (enregistrement MX), et les serveurs (Exchange, Postfix). Notions de sécurité anti-spam (SPF/DKIM/DMARC).' };
const block = (t: Parameters<typeof makePageBlock>[0], p: Partial<PageBlock>) => Object.assign(makePageBlock(t), p);
const note = (c: string, t: string, h: string) => block('html', { html: `<aside class="pb-note pb-note-${c}"><p class="pb-note-title">${t}</p>${h}</aside>` });
const styleBlock = block('html', { html: `<style>.mg-t{border-collapse:collapse;width:100%;font-size:13px;margin:6px 0}.mg-t th,.mg-t td{border:1px solid var(--border);padding:7px 10px;text-align:left}.mg-t th{background:var(--surface-2)}</style>` });
const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Réseau / Services', title: PAGE.title, subtitle: 'Ce qui se passe entre « Envoyer » et la réception dans la boîte du destinataire.' }),
  styleBlock,
  block('html', { html: '<p>Le mail repose sur des protocoles séparés pour l’<strong>envoi</strong> et la <strong>réception</strong>, et sur le <strong>DNS</strong> pour trouver le serveur du destinataire.</p>' }),
  block('heading', { level: 2, text: '1) Les protocoles' }),
  block('html', { html: `<table class="mg-t"><thead><tr><th>Protocole</th><th>Rôle</th><th>Port</th></tr></thead><tbody>
    <tr><td><strong>SMTP</strong></td><td><strong>envoi</strong> et transfert entre serveurs</td><td>25 (587 en soumission client, 465 chiffré)</td></tr>
    <tr><td><strong>POP3</strong></td><td><strong>récupère</strong> les mails et les <strong>télécharge</strong> (souvent les retire du serveur)</td><td>110 (995 chiffré)</td></tr>
    <tr><td><strong>IMAP</strong></td><td><strong>consulte</strong> les mails en les <strong>laissant sur le serveur</strong> (synchro multi-appareils)</td><td>143 (993 chiffré)</td></tr>
  </tbody></table>` }),
  note('gray', '📮 POP vs IMAP', '<p><strong>POP3</strong> = un seul appareil, mails rapatriés en local. <strong>IMAP</strong> = plusieurs appareils synchronisés (les dossiers/états restent sur le serveur). Aujourd’hui on utilise quasi toujours <strong>IMAP</strong>.</p>'),
  block('heading', { level: 2, text: '2) Le rôle du DNS (enregistrement MX)' }),
  block('html', { html: '<p>Pour envoyer à <code>jean@exemple.com</code>, le serveur d’envoi interroge le <strong>DNS</strong> du domaine <code>exemple.com</code> et lit son enregistrement <strong>MX</strong> (<em>Mail eXchanger</em>) : il indique <strong>quel serveur</strong> reçoit le courrier de ce domaine (et avec quelle priorité). Voir <a href="/pages/procedure-dns">DNS</a>.</p>' }),
  block('heading', { level: 2, text: '3) Le trajet d’un mail' }),
  block('html', { html: '<ol style="padding-left:22px;line-height:1.8"><li>Le client (Outlook…) envoie le mail à son serveur via <strong>SMTP</strong>.</li><li>Ce serveur cherche le <strong>MX</strong> du domaine destinataire (DNS) et lui transfère le mail en <strong>SMTP</strong>.</li><li>Le serveur destinataire le range dans la boîte du destinataire.</li><li>Le destinataire le lit via <strong>IMAP</strong> (ou POP3).</li></ol>' }),
  block('heading', { level: 2, text: '4) Les serveurs de messagerie' }),
  block('html', { html: '<p>Côté Microsoft : <strong>Exchange Server</strong> (souvent couplé à AD) ou <strong>Microsoft 365</strong> en cloud. Côté Linux : <strong>Postfix</strong> (SMTP) + <strong>Dovecot</strong> (IMAP/POP). Un serveur mal configuré peut devenir un <em>open relay</em> (relais ouvert) exploité pour du spam.</p>' }),
  note('yellow', '🛡️ Anti-spam / authenticité', '<p>Trois enregistrements DNS protègent le domaine et améliorent la délivrabilité : <strong>SPF</strong> (quels serveurs ont le droit d’envoyer pour le domaine), <strong>DKIM</strong> (signature cryptographique des mails) et <strong>DMARC</strong> (politique + rapports). Sans eux, les mails partent souvent en spam.</p>'),
  note('green', '🔗 Liens', '<p><a href="/pages/procedure-dns">DNS (enregistrement MX)</a> · <a href="/pages/tcp-et-udp">TCP & UDP (les ports)</a> · <a href="/pages/notions-complementaires">Notions clés</a>.</p>'),
];
function cookieFrom(res: Response): string { const sc = (res.headers as any).getSetCookie?.() as string[] | undefined; return (sc && sc.length ? sc : [res.headers.get('set-cookie') || '']).map(c => c.split(';')[0]).filter(Boolean).join('; '); }
async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: PW }) });
  if (!login.ok) throw new Error(`login ${login.status}`);
  const cookie = cookieFrom(login); const h = { 'Content-Type': 'application/json', Cookie: cookie };
  const existing = await (await fetch(`${BASE}/api/admin/pages`, { headers: { Cookie: cookie } })).json() as Array<{ id: number; slug: string }>;
  const cur = existing.find(e => e.slug === PAGE.slug);
  const body = JSON.stringify({ title: PAGE.title, slug: PAGE.slug, excerpt: PAGE.excerpt, content: renderPageBlocksToHtml(blocks), builder_json: serializePageBlocks(blocks), published: 1 });
  const res = cur ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body }) : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
  console.log(`PAGE ${PAGE.slug}`, res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());
  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } }); console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });

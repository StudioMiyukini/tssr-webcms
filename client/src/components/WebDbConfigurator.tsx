/**
 * Configurateur « duo web + base » — îlot React (data-block="web-db-configurator").
 *
 * Deux VM Debian clonées depuis un master : l'une avec nginx + Node.js (le
 * moteur), l'autre avec MariaDB. Chacune reçoit une IP fixe ; le moteur est
 * relié à la base sans rien saisir (les identifiants sont écrits dans le
 * fichier d'environnement du service), et une page de test affiche l'état de
 * l'affichage et de la connexion à la base.
 *
 * Trois scripts sortent de l'outil, dans l'ordre où on les joue : l'hôte
 * (clonage), la VM base, la VM web. Le mot de passe est celui du labo,
 * « Azerty77 », partout — c'est une convention de formation, pas une pratique
 * de production, et la page le dit.
 */
import { memo, useDeferredValue, useMemo, useRef, useState } from 'react';
import { MDP, genererScripts, listeBoites, nomHote, pourConsole, type Hyperviseur } from '@/lib/web-db-scripts';

const champ: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' };
const mono: React.CSSProperties = { fontFamily: "ui-monospace,'Space Mono',SFMono-Regular,Menlo,Consolas,monospace" };
const etiquette: React.CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 4 };
const groupe: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', background: 'var(--surface-2)', marginBottom: 14 };
const legende: React.CSSProperties = { fontWeight: 700, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const rangee: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 };
const bouton: React.CSSProperties = { padding: '6px 14px', border: '1px solid var(--accent)', borderRadius: 8, background: 'transparent', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' };
const pre: React.CSSProperties = { ...mono, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', overflowX: 'auto', fontSize: 12.5, lineHeight: 1.55, margin: 0, whiteSpace: 'pre' };

const CIDRS = [16, 22, 23, 24, 25, 26, 27, 28];

// Un bloc de script ne se re-rend que si son texte change (les quatre font 40 Ko).
const Bloc = memo(function Bloc({ code, refPre }: { code: string; refPre: (el: HTMLPreElement | null) => void }) {
  return <pre ref={refPre} style={pre} tabIndex={0}><code>{code}</code></pre>;
});

const lsGet = (k: string, d: string) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* indisponible */ } };

const IP_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const ipValide = (s: string) => IP_RE.test(s);
const reseauDe = (ip: string, cidr: number) => {
  const n = ip.split('.').map(Number).reduce((a, b) => (a << 8) + b, 0) >>> 0;
  const masque = cidr === 0 ? 0 : (0xffffffff << (32 - cidr)) >>> 0;
  return (n & masque) >>> 0;
};
const reseauTexte = (ip: string, cidr: number) => { const n = reseauDe(ip, cidr); return [24, 16, 8, 0].map(s => (n >>> s) & 255).join('.'); };
const passerelleDe = (ip: string) => { const m = ip.match(/^(\d+\.\d+\.\d+)\.\d+$/); return m ? `${m[1]}.254` : ''; };
const masqueDe = (cidr: number) => { const m = cidr === 0 ? 0 : (0xffffffff << (32 - cidr)) >>> 0; return [24, 16, 8, 0].map(s => (m >>> s) & 255).join('.'); };

/*
 * @id     tssr.atelier.webDbConfigurator
 * @do     configurer_duo_web_bdd
 * @role   ui
 * @layer  ui
 * @human  Atelier : deux VM Debian (nginx + Node / MariaDB) clonées et reliées.
 */
export function WebDbConfigurator() {
  // --- Hôte ---
  const [hv, setHv] = useState<Hyperviseur>(() => (lsGet('wdb_hv', 'hyperv') as Hyperviseur));
  const [master, setMaster] = useState(() => lsGet('wdb_master', 'master-debian'));
  const [masterId, setMasterId] = useState(() => lsGet('wdb_masterid', '9000'));
  const [exportPath, setExportPath] = useState(() => lsGet('wdb_export', 'C:\\TEMP'));
  const [vhdDir, setVhdDir] = useState(() => lsGet('wdb_vhddir', 'C:\\Hyper-V\\VHDs'));
  const [sw, setSw] = useState(() => lsGet('wdb_sw', 'COM_private'));
  const [copierFichiers, setCopierFichiers] = useState(true);
  // --- VM ---
  const [vmWeb, setVmWeb] = useState('SRV_WEB_01');
  const [vmBdd, setVmBdd] = useState('SRV_BDD_01');
  const [idWeb, setIdWeb] = useState('201');
  const [idBdd, setIdBdd] = useState('202');
  const [vcpu, setVcpu] = useState('2');
  const [ram, setRam] = useState('2');
  // --- Réseau ---
  const [ipWeb, setIpWeb] = useState('192.168.30.5');
  const [cidrWeb, setCidrWeb] = useState('24');
  const [gwWebSaisi, setGwWeb] = useState('');
  const [dnsWebSaisi, setDnsWeb] = useState('');
  const [ipBdd, setIpBdd] = useState('192.168.20.5');
  const [cidrBdd, setCidrBdd] = useState('24');
  const [gwBddSaisi, setGwBdd] = useState('');
  const [dnsBddSaisi, setDnsBdd] = useState('');
  const [iface, setIface] = useState('');
  // --- Application ---
  const [bdd, setBdd] = useState('appdb');
  const [utilisateur, setUtilisateur] = useState('appuser');
  const [nodeSource, setNodeSource] = useState(false);
  const [mdpSysteme, setMdpSysteme] = useState(true);
  // --- Messagerie en DMZ (optionnelle) ---
  const [mail, setMail] = useState(false);
  const [vmMail, setVmMail] = useState('SRV_MAIL_01');
  const [idMail, setIdMail] = useState('203');
  const [ipMail, setIpMail] = useState('192.168.10.5');
  const [cidrMail, setCidrMail] = useState('24');
  const [gwMailSaisi, setGwMail] = useState('');
  const [dnsMailSaisi, setDnsMail] = useState('');
  const [domaineMail, setDomaineMail] = useState('entreprise.lan');
  const [boites, setBoites] = useState('alice, bob');
  const [glpi, setGlpi] = useState(false);
  const [copie, setCopie] = useState('');

  const persist = (k: string, v: string, set: (v: string) => void) => { set(v); lsSet(k, v); };

  // Passerelle : .254 du sous-reseau de la VM sauf saisie ; DNS : la passerelle sauf saisie.
  const gwWeb = gwWebSaisi || passerelleDe(ipWeb);
  const gwBdd = gwBddSaisi || passerelleDe(ipBdd);
  const dnsWeb = dnsWebSaisi || gwWeb;
  const dnsBdd = dnsBddSaisi || gwBdd;
  const gwMail = gwMailSaisi || passerelleDe(ipMail);
  const dnsMail = dnsMailSaisi || gwMail;
  const hoteMail = nomHote(vmMail);
  const memeReseau = ipValide(ipWeb) && ipValide(ipBdd) && cidrWeb === cidrBdd && reseauDe(ipWeb, Number(cidrWeb)) === reseauDe(ipBdd, Number(cidrBdd));
  const hoteWeb = nomHote(vmWeb);
  const hoteBdd = nomHote(vmBdd);

  // Les fautes que la syntaxe ne signale pas : c'est là qu'on perd une heure.
  const soucis = useMemo(() => {
    const s: string[] = [];
    const vms: [string, string, string, string, string][] = [['web', ipWeb, cidrWeb, gwWeb, dnsWeb], ['base', ipBdd, cidrBdd, gwBdd, dnsBdd]];
    if (mail) vms.push(['messagerie', ipMail, cidrMail, gwMail, dnsMail]);
    for (const [nom, ip, cidr, gw, dns] of vms) {
      if (!ipValide(ip)) { s.push(`L'adresse de la VM ${nom} « ${ip} » n'est pas une adresse IPv4.`); continue; }
      if (!ipValide(gw)) s.push(`La passerelle de la VM ${nom} « ${gw} » n'est pas une adresse IPv4.`);
      else if (reseauDe(ip, Number(cidr)) !== reseauDe(gw, Number(cidr))) s.push(`VM ${nom} : la passerelle ${gw} est hors de son sous-réseau ${ip}/${cidr} — pas de sortie, ni vers l'autre VM ni vers Internet.`);
      else if (gw === ip) s.push(`VM ${nom} : la passerelle est l'adresse de la VM elle-même.`);
      if (!ipValide(dns)) s.push(`Le DNS de la VM ${nom} « ${dns} » n'est pas une adresse IPv4.`);
    }
    if (ipValide(ipWeb) && ipValide(ipBdd) && ipWeb === ipBdd) s.push('Les deux VM ont la même adresse.');
    if (vmWeb.trim() === vmBdd.trim()) s.push('Les deux VM portent le même nom.');
    if (hv === 'proxmox' && idWeb === idBdd) s.push('Les deux VM Proxmox ont le même identifiant.');
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(bdd)) s.push('Le nom de la base : lettres, chiffres et _ seulement.');
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(utilisateur)) s.push('Le nom d’utilisateur MariaDB : lettres, chiffres et _ (32 caractères max).');
    if (mail) {
      if (ipValide(ipMail) && (ipMail === ipWeb || ipMail === ipBdd)) s.push('La VM messagerie a la même adresse qu’une autre VM.');
      if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domaineMail)) s.push('Le domaine de messagerie doit ressembler à « entreprise.lan » (minuscules, un point au moins).');
      if (!listeBoites(boites).length) s.push('Au moins une boîte (lettres, chiffres, . _ -), séparées par des virgules.');
      if (hv === 'proxmox' && (idMail === idWeb || idMail === idBdd)) s.push('La VM messagerie Proxmox a le même identifiant qu’une autre VM.');
    }
    return s;
  }, [ipWeb, cidrWeb, gwWeb, dnsWeb, ipBdd, cidrBdd, gwBdd, dnsBdd, vmWeb, vmBdd, hv, idWeb, idBdd, bdd, utilisateur, mail, ipMail, cidrMail, gwMail, dnsMail, domaineMail, boites, idMail]);

  // Les quatre scripts (40 Ko de texte) se regenerent a chaque frappe : en valeur differee, la saisie reste fluide.
  const params = useDeferredValue(useMemo(() => ({ hv, master, masterId, exportPath, vhdDir, sw, copierFichiers, vmWeb, vmBdd, idWeb, idBdd, vcpu, ram, ipWeb, cidrWeb, gwWeb, dnsWeb, ipBdd, cidrBdd, gwBdd, dnsBdd, iface, bdd, utilisateur, nodeSource, mdpSysteme, mail, vmMail, idMail, ipMail, cidrMail, gwMail, dnsMail, domaineMail, boites, glpi }),
    [hv, master, masterId, exportPath, vhdDir, sw, copierFichiers, vmWeb, vmBdd, idWeb, idBdd, vcpu, ram, ipWeb, cidrWeb, gwWeb, dnsWeb, ipBdd, cidrBdd, gwBdd, dnsBdd, iface, bdd, utilisateur, nodeSource, mdpSysteme, mail, vmMail, idMail, ipMail, cidrMail, gwMail, dnsMail, domaineMail, boites, glpi]));
  const sections = useMemo(() => genererScripts(params), [params]);

  const pres = useRef<Record<string, HTMLPreElement | null>>({});
  const copier = async (id: string, texte: string) => {
    const fini = () => { setCopie(id); setTimeout(() => setCopie(''), 1600); };
    try { await navigator.clipboard.writeText(texte); fini(); return; } catch { /* API refusee : on passe par la selection */ }
    const ta = document.createElement('textarea');
    ta.value = texte; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    if (ok) { fini(); return; }
    // Dernier recours : selectionner le bloc, l'utilisateur fait Ctrl+C.
    const pre = pres.current[id];
    if (pre) { const r = document.createRange(); r.selectNodeContents(pre); const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(r); }
    setCopie('sel-' + id); setTimeout(() => setCopie(''), 2500);
  };
  const telecharger = (texte: string, nom: string) => {
    // BOM pour PowerShell (accents dans les commentaires) ; jamais de BOM ni de CRLF dans un script bash.
    const ps = nom.endsWith('.ps1');
    const blob = new Blob([ps ? '\uFEFF' + texte : texte.replace(/\r\n/g, '\n') + '\n'], { type: ps ? 'text/plain;charset=utf-8' : 'text/x-shellscript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nom; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  return (
    <div style={{ margin: '14px 0' }}>
      {/* Hôte */}
      <div style={groupe}>
        <div style={legende}>🧬 Hôte et master</div>
        <div style={rangee}>
          <div>
            <label style={etiquette}>Hyperviseur</label>
            <select style={champ} value={hv} onChange={e => persist('wdb_hv', e.target.value, v => setHv(v as Hyperviseur))}>
              <option value="hyperv">Hyper-V (Export / Import)</option>
              <option value="proxmox">Proxmox VE (qm clone)</option>
            </select>
          </div>
          <div>
            <label style={etiquette}>VM master à cloner</label>
            <input style={{ ...champ, ...mono }} value={master} onChange={e => persist('wdb_master', e.target.value, setMaster)} placeholder="master-debian" />
          </div>
          {hv === 'proxmox' && (
            <div>
              <label style={etiquette}>VMID du master</label>
              <input style={champ} value={masterId} onChange={e => persist('wdb_masterid', e.target.value.replace(/\D/g, ''), setMasterId)} />
            </div>
          )}
          <div>
            <label style={etiquette}>{hv === 'hyperv' ? 'Commutateur virtuel' : 'Pont (bridge)'}</label>
            <input style={champ} value={sw} onChange={e => persist('wdb_sw', e.target.value, setSw)} placeholder={hv === 'hyperv' ? 'COM_private' : 'vmbr0'} />
          </div>
          <div>
            <label style={etiquette}>vCPU par VM</label>
            <input type="number" min={1} style={champ} value={vcpu} onChange={e => setVcpu(e.target.value)} />
          </div>
          <div>
            <label style={etiquette}>RAM par VM (Go)</label>
            <input type="number" min={1} style={champ} value={ram} onChange={e => setRam(e.target.value)} />
          </div>
        </div>
        {hv === 'hyperv' && (
          <div style={{ ...rangee, marginTop: 10 }}>
            <div>
              <label style={etiquette}>Dossier d’export temporaire</label>
              <input style={champ} value={exportPath} onChange={e => persist('wdb_export', e.target.value, setExportPath)} />
            </div>
            <div>
              <label style={etiquette}>Dossier des VM clonées</label>
              <input style={champ} value={vhdDir} onChange={e => persist('wdb_vhddir', e.target.value, setVhdDir)} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, cursor: 'pointer', alignSelf: 'end', paddingBottom: 8 }}>
              <input type="checkbox" checked={copierFichiers} onChange={e => setCopierFichiers(e.target.checked)} />
              Déposer les scripts dans les VM (Copy-VMFile)
            </label>
          </div>
        )}
        <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>💾 Hyperviseur, master, dossiers et commutateur sont mémorisés dans ce navigateur. Les VM ont besoin d’<strong>Internet pendant l’installation</strong> (apt, npm) : un commutateur externe, ou un pare-feu de labo sur le réseau privé.</div>
      </div>

      <div style={rangee}>
        {/* VM web */}
        <div style={groupe}>
          <div style={legende}>🟢 VM 1 — moteur (nginx + Node.js)</div>
          <label style={etiquette}>Nom de la VM</label>
          <input style={{ ...champ, ...mono }} value={vmWeb} onChange={e => setVmWeb(e.target.value)} />
          <div style={{ ...rangee, marginTop: 10 }}>
            <div>
              <label style={etiquette}>Adresse IP</label>
              <input style={{ ...champ, ...mono }} value={ipWeb} onChange={e => setIpWeb(e.target.value.trim())} />
            </div>
            <div>
              <label style={etiquette}>Masque</label>
              <select style={champ} value={cidrWeb} onChange={e => setCidrWeb(e.target.value)}>
                {CIDRS.map(c => <option key={c} value={String(c)}>/{c} — {masqueDe(c)}</option>)}
              </select>
            </div>
            <div>
              <label style={etiquette}>Passerelle {!gwWebSaisi && <span className="meta" style={{ fontWeight: 400 }}>(auto .254)</span>}</label>
              <input style={{ ...champ, ...mono }} value={gwWeb} onChange={e => setGwWeb(e.target.value.trim())} />
            </div>
            <div>
              <label style={etiquette}>DNS {!dnsWebSaisi && <span className="meta" style={{ fontWeight: 400 }}>(= passerelle)</span>}</label>
              <input style={{ ...champ, ...mono }} value={dnsWeb} onChange={e => setDnsWeb(e.target.value.trim())} />
            </div>
            {hv === 'proxmox' && (
              <div>
                <label style={etiquette}>VMID</label>
                <input style={champ} value={idWeb} onChange={e => setIdWeb(e.target.value.replace(/\D/g, ''))} />
              </div>
            )}
          </div>
          <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>Nom d’hôte Linux : <code>{hoteWeb}</code> · réseau <code>{ipValide(ipWeb) ? reseauTexte(ipWeb, Number(cidrWeb)) : '?'}/{cidrWeb}</code></div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, cursor: 'pointer', marginTop: 10 }}>
            <input type="checkbox" checked={glpi} onChange={e => setGlpi(e.target.checked)} />
            🎫 Installer <strong>GLPI</strong> ici (PHP + nginx), base <code>glpi</code> sur la VM base
          </label>
          {glpi && <div className="meta" style={{ fontSize: 11.5, marginTop: 6 }}>Dernière version depuis GitHub, installée par sa console (pas d’assistant web) sur <code>glpi@{ipBdd}</code>. Servi sur <code>http://{ipWeb}:8080/</code> (le port 80 garde la page de test) et sur le port 80 sous le nom <code>glpi.{mail ? domaineMail : 'entreprise.lan'}</code>. Comptes par défaut <code>glpi/glpi</code>, <code>tech/tech</code>… à changer à la première connexion. Le script base charge les fuseaux horaires que GLPI réclame.</div>}
        </div>
        {/* VM base */}
        <div style={groupe}>
          <div style={legende}>🟣 VM 2 — base de données (MariaDB)</div>
          <label style={etiquette}>Nom de la VM</label>
          <input style={{ ...champ, ...mono }} value={vmBdd} onChange={e => setVmBdd(e.target.value)} />
          <div style={{ ...rangee, marginTop: 10 }}>
            <div>
              <label style={etiquette}>Adresse IP</label>
              <input style={{ ...champ, ...mono }} value={ipBdd} onChange={e => setIpBdd(e.target.value.trim())} />
            </div>
            <div>
              <label style={etiquette}>Masque</label>
              <select style={champ} value={cidrBdd} onChange={e => setCidrBdd(e.target.value)}>
                {CIDRS.map(c => <option key={c} value={String(c)}>/{c} — {masqueDe(c)}</option>)}
              </select>
            </div>
            <div>
              <label style={etiquette}>Passerelle {!gwBddSaisi && <span className="meta" style={{ fontWeight: 400 }}>(auto .254)</span>}</label>
              <input style={{ ...champ, ...mono }} value={gwBdd} onChange={e => setGwBdd(e.target.value.trim())} />
            </div>
            <div>
              <label style={etiquette}>DNS {!dnsBddSaisi && <span className="meta" style={{ fontWeight: 400 }}>(= passerelle)</span>}</label>
              <input style={{ ...champ, ...mono }} value={dnsBdd} onChange={e => setDnsBdd(e.target.value.trim())} />
            </div>
            {hv === 'proxmox' && (
              <div>
                <label style={etiquette}>VMID</label>
                <input style={champ} value={idBdd} onChange={e => setIdBdd(e.target.value.replace(/\D/g, ''))} />
              </div>
            )}
          </div>
          <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>Nom d’hôte Linux : <code>{hoteBdd}</code> · réseau <code>{ipValide(ipBdd) ? reseauTexte(ipBdd, Number(cidrBdd)) : '?'}/{cidrBdd}</code></div>
        </div>
      </div>

      {/* Messagerie en DMZ */}
      <div style={{ ...groupe, borderColor: mail ? 'var(--accent)' : 'var(--border)' }}>
        <div style={legende}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={mail} onChange={e => setMail(e.target.checked)} />
            📧 VM 3 — messagerie en DMZ (Postfix + Dovecot + Roundcube, comptes dans la base)
          </label>
        </div>
        {mail ? (
          <>
            <div style={rangee}>
              <div>
                <label style={etiquette}>Nom de la VM</label>
                <input style={{ ...champ, ...mono }} value={vmMail} onChange={e => setVmMail(e.target.value)} />
              </div>
              <div>
                <label style={etiquette}>Domaine de messagerie</label>
                <input style={{ ...champ, ...mono }} value={domaineMail} onChange={e => setDomaineMail(e.target.value.trim().toLowerCase())} placeholder="entreprise.lan" />
              </div>
              <div>
                <label style={etiquette}>Boîtes (séparées par des virgules)</label>
                <input style={{ ...champ, ...mono }} value={boites} onChange={e => setBoites(e.target.value)} placeholder="alice, bob" />
              </div>
              {hv === 'proxmox' && (
                <div>
                  <label style={etiquette}>VMID</label>
                  <input style={champ} value={idMail} onChange={e => setIdMail(e.target.value.replace(/\D/g, ''))} />
                </div>
              )}
            </div>
            <div style={{ ...rangee, marginTop: 10 }}>
              <div>
                <label style={etiquette}>Adresse IP (DMZ)</label>
                <input style={{ ...champ, ...mono }} value={ipMail} onChange={e => setIpMail(e.target.value.trim())} />
              </div>
              <div>
                <label style={etiquette}>Masque</label>
                <select style={champ} value={cidrMail} onChange={e => setCidrMail(e.target.value)}>
                  {CIDRS.map(c => <option key={c} value={String(c)}>/{c} — {masqueDe(c)}</option>)}
                </select>
              </div>
              <div>
                <label style={etiquette}>Passerelle {!gwMailSaisi && <span className="meta" style={{ fontWeight: 400 }}>(auto .254)</span>}</label>
                <input style={{ ...champ, ...mono }} value={gwMail} onChange={e => setGwMail(e.target.value.trim())} />
              </div>
              <div>
                <label style={etiquette}>DNS {!dnsMailSaisi && <span className="meta" style={{ fontWeight: 400 }}>(= passerelle)</span>}</label>
                <input style={{ ...champ, ...mono }} value={dnsMail} onChange={e => setDnsMail(e.target.value.trim())} />
              </div>
            </div>
            <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>
              Nom d’hôte <code>{hoteMail}</code>, aussi <code>mail.{domaineMail}</code> · comptes {listeBoites(boites).map(b => <code key={b} style={{ marginRight: 4 }}>{b}@{domaineMail}</code>)} (mot de passe {MDP}) · alias <code>postmaster@</code> et <code>contact@</code> vers la première boîte · webmail <code>http://{ipMail}/roundcube/</code>.
              Les comptes vivent dans la base <code>maildb</code> de la VM base (lus par Postfix et Dovecot avec <code>mailuser@{ipMail}</code>, lecture seule) ; Roundcube a sa base <code>roundcube</code>.
            </div>
            <aside className="pb-note pb-note-yellow" style={{ marginTop: 10, marginBottom: 0 }}>
              <p className="pb-note-title">🧱 Règles de pare-feu entre la DMZ et le reste</p>
              <p><strong>DMZ → LAN</strong> : TCP 3306 de {ipMail} vers {ipBdd} (le seul flux sortant de la DMZ vers le LAN — c’est le prix du « réutiliser la base ») · <strong>LAN → DMZ</strong> : TCP 25, 587, 143, 993, 80 vers {ipMail} · <strong>DMZ → Internet</strong> : 80/443 (apt) · <strong>Internet → DMZ</strong> : TCP 25 vers {ipMail} seulement si le domaine reçoit du courrier de l’extérieur. DNS interne : <code>mail.{domaineMail}</code> → {ipMail}, MX de <code>{domaineMail}</code> → <code>mail.{domaineMail}</code>.</p>
            </aside>
          </>
        ) : (
          <div className="meta" style={{ fontSize: 12 }}>Coche pour ajouter un troisième clone en DMZ : serveur SMTP/IMAP avec webmail, dont les comptes et le webmail utilisent MariaDB sur la VM base. Un script ④ s’ajoute, et le script base crée les bases <code>maildb</code> et <code>roundcube</code>.</div>
        )}
      </div>

      {/* Entre les deux VM */}
      <div style={groupe}>
        <div style={legende}>🔀 Entre les deux VM</div>
        <div style={rangee}>
          <div>
            <label style={etiquette}>Carte réseau (dans les VM) {!iface && <span className="meta" style={{ fontWeight: 400 }}>(auto-détectée)</span>}</label>
            <input style={{ ...champ, ...mono }} value={iface} onChange={e => setIface(e.target.value.trim())} placeholder="eth0" />
          </div>
        </div>
        {memeReseau ? (
          <div className="meta" style={{ fontSize: 12, marginTop: 8 }}>Les deux VM sont dans le même sous-réseau : le moteur joint la base directement, sans routeur.</div>
        ) : (
          <aside className="pb-note pb-note-blue" style={{ marginTop: 10, marginBottom: 0 }}>
            <p className="pb-note-title">🔀 Deux réseaux différents : le flux passe par le routeur</p>
            <p>Le moteur <code>{ipWeb}</code> joindra la base <code>{ipBdd}</code> <strong>via sa passerelle {gwWeb}</strong>. Le routeur ou pare-feu entre les deux (OPNsense, routeur Cisco…) doit <strong>router les deux sous-réseaux et laisser passer TCP 3306 de {ipWeb} vers {ipBdd}</strong> (et ICMP pour les tests). MariaDB, lui, n’acceptera <code>{utilisateur}</code> que depuis {ipWeb} — la règle est écrite pour ça.</p>
          </aside>
        )}
      </div>

      {/* Application */}
      <div style={groupe}>
        <div style={legende}>🗄️ Base et identifiants</div>
        <div style={rangee}>
          <div>
            <label style={etiquette}>Base de données</label>
            <input style={{ ...champ, ...mono }} value={bdd} onChange={e => setBdd(e.target.value)} />
          </div>
          <div>
            <label style={etiquette}>Utilisateur MariaDB</label>
            <input style={{ ...champ, ...mono }} value={utilisateur} onChange={e => setUtilisateur(e.target.value)} />
          </div>
          <div>
            <label style={etiquette}>Mot de passe (labo)</label>
            <input style={{ ...champ, ...mono, fontWeight: 700, color: 'var(--accent)' }} value={MDP} readOnly title="Convention du labo : le même mot de passe partout" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, cursor: 'pointer' }}>
            <input type="checkbox" checked={mdpSysteme} onChange={e => setMdpSysteme(e.target.checked)} />
            Mettre aussi « {MDP} » sur root et l’utilisateur Linux des deux VM
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, cursor: 'pointer' }}>
            <input type="checkbox" checked={nodeSource} onChange={e => setNodeSource(e.target.checked)} />
            Node.js 22 LTS (NodeSource) plutôt que celui de Debian
          </label>
        </div>
        <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>L’utilisateur <code>{utilisateur}</code> n’est autorisé que <strong>depuis {ipWeb}</strong> : la base n’accepte le moteur, et personne d’autre. Le mot de passe vit dans <code>/srv/app/.env</code> (lisible par www-data seulement), jamais dans le code.</div>
      </div>

      {soucis.length > 0 && (
        <aside className="pb-note pb-note-red" style={{ marginBottom: 14 }}>
          <p className="pb-note-title">🚫 À corriger avant de copier</p>
          <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>{soucis.map(s => <li key={s}>{s}</li>)}</ul>
        </aside>
      )}

      {/* Sorties */}
      {sections.map(sec => (
        <div key={sec.id} style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 6px', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>📜 {sec.titre}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {sec.id !== 'verif' && (
                <button type="button" onClick={() => telecharger(sec.code, sec.fichier)} style={{ ...bouton, borderColor: 'var(--border)', color: 'var(--text)' }} title={`Télécharger ${sec.fichier}`}>💾 {sec.fichier.replace(/^.*\./, '.')}</button>
              )}
              {(sec.id === 'bdd' || sec.id === 'web' || sec.id === 'mail') && (
                <button type="button" onClick={() => copier('console-' + sec.id, pourConsole(sec))} style={{ ...bouton, background: copie === 'console-' + sec.id ? 'var(--accent)' : 'transparent', color: copie === 'console-' + sec.id ? '#fff' : 'var(--accent)' }} title="Copie le script enveloppé dans un cat > /root/….sh <<'FIN' … FIN suivi de sudo bash : à coller tel quel dans le terminal de la VM">
                  {copie === 'console-' + sec.id ? '✓ Copié' : '🖥️ Pour la console'}
                </button>
              )}
              <button type="button" onClick={() => copier(sec.id, sec.code)} style={{ ...bouton, background: copie === sec.id ? 'var(--accent)' : 'transparent', color: copie === sec.id ? '#fff' : 'var(--accent)' }} title="Le script seul, à enregistrer dans un fichier">
                {copie === sec.id ? '✓ Copié' : copie === 'sel-' + sec.id ? 'Sélectionné — Ctrl+C' : 'Copier'}
              </button>
            </div>
          </div>
          <Bloc code={sec.code} refPre={el => { pres.current[sec.id] = el; }} />
        </div>
      ))}
    </div>
  );
}

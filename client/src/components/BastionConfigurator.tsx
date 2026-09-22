/**
 * Configurateur « bastion SSH » — îlot React (data-block="bastion-configurator").
 *
 * Une VM Debian clonée depuis le master devient la seule porte d'entrée SSH
 * vers les serveurs du labo : administrateurs nommés avec leur clé, root
 * interdit, fail2ban, journal ; chaque serveur n'accepte SSH que depuis le
 * bastion ; le poste de l'administrateur rebondit avec ProxyJump.
 *
 * Fait suite au configurateur « duo web + base » : mêmes réglages d'hôte
 * (mémorisés dans le navigateur), mêmes briques de script.
 */
import { memo, useDeferredValue, useMemo, useRef, useState } from 'react';
import { deposerScript, lignesRecuperation } from '@/lib/partage-script';
import { MDP, nomHote, type Hyperviseur } from '@/lib/web-db-scripts';
import { genererScriptsBastion, listeAdmins, listeCibles, pourConsoleBastion, type Auth } from '@/lib/bastion-scripts';

const champ: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' };
const mono: React.CSSProperties = { fontFamily: "ui-monospace,'Space Mono',SFMono-Regular,Menlo,Consolas,monospace" };
const etiquette: React.CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 4 };
const groupe: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', background: 'var(--surface-2)', marginBottom: 14 };
const legende: React.CSSProperties = { fontWeight: 700, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const rangee: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 };
const bouton: React.CSSProperties = { padding: '6px 14px', border: '1px solid var(--accent)', borderRadius: 8, background: 'transparent', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' };
const pre: React.CSSProperties = { ...mono, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', overflowX: 'auto', fontSize: 12.5, lineHeight: 1.55, margin: 0, whiteSpace: 'pre' };
const zone: React.CSSProperties = { ...champ, ...mono, minHeight: 84, resize: 'vertical', fontSize: 12.5 };
const CIDRS = [16, 22, 23, 24, 25, 26, 27, 28];

const Bloc = memo(function Bloc({ code, refPre }: { code: string; refPre: (el: HTMLPreElement | null) => void }) {
  return <pre ref={refPre} style={pre} tabIndex={0}><code>{code}</code></pre>;
});

const lsGet = (k: string, d: string) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* indisponible */ } };
const IP_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const ipValide = (s: string) => IP_RE.test(s);
const reseauDe = (ip: string, cidr: number) => { const n = ip.split('.').map(Number).reduce((a, b) => (a << 8) + b, 0) >>> 0; const m = cidr === 0 ? 0 : (0xffffffff << (32 - cidr)) >>> 0; return (n & m) >>> 0; };
const passerelleDe = (ip: string) => { const m = ip.match(/^(\d+\.\d+\.\d+)\.\d+$/); return m ? `${m[1]}.254` : ''; };
const masqueDe = (cidr: number) => { const m = cidr === 0 ? 0 : (0xffffffff << (32 - cidr)) >>> 0; return [24, 16, 8, 0].map(s => (m >>> s) & 255).join('.'); };

/*
 * @id     tssr.atelier.bastionConfigurator
 * @do     configurer_bastion_ssh
 * @role   ui
 * @layer  ui
 * @human  Atelier : bastion SSH cloné, serveurs verrouillés derrière lui, poste en ProxyJump.
 */
export function BastionConfigurator() {
  // Hôte : les mêmes clés de mémorisation que le configurateur duo web + base
  const [hv, setHv] = useState<Hyperviseur>(() => (lsGet('wdb_hv', 'hyperv') as Hyperviseur));
  const [master, setMaster] = useState(() => lsGet('wdb_master', 'master-debian'));
  const [masterId, setMasterId] = useState(() => lsGet('wdb_masterid', '9000'));
  const [exportPath, setExportPath] = useState(() => lsGet('wdb_export', 'C:\\TEMP'));
  const [vhdDir, setVhdDir] = useState(() => lsGet('wdb_vhddir', 'C:\\Hyper-V\\VHDs'));
  const [sw, setSw] = useState(() => lsGet('wdb_sw', 'COM_private'));
  const [copierFichiers, setCopierFichiers] = useState(true);
  // Bastion
  const [vm, setVm] = useState('SRV_BASTION_01');
  const [id, setId] = useState('204');
  const [ip, setIp] = useState('192.168.40.5');
  const [cidr, setCidr] = useState('24');
  const [gwSaisi, setGw] = useState('');
  const [dnsSaisi, setDns] = useState('');
  const [iface, setIface] = useState('');
  const [port, setPort] = useState('22');
  const [admins, setAdmins] = useState('miyukini\njean ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... jean@poste');
  const [cibles, setCibles] = useState('srv-web-01 192.168.30.5\nsrv-bdd-01 192.168.20.5\nsrv-mail-01 192.168.10.5');
  const [auth, setAuth] = useState<Auth>('les-deux');
  const [genererCles, setGenererCles] = useState(false);
  const [mfa, setMfa] = useState(false);
  const [fail2ban, setFail2ban] = useState(true);
  const [mdpSysteme, setMdpSysteme] = useState(true);
  const [copie, setCopie] = useState('');
  const pres = useRef<Record<string, HTMLPreElement | null>>({});

  const persist = (k: string, v: string, set: (v: string) => void) => { set(v); lsSet(k, v); };
  const gw = gwSaisi || passerelleDe(ip);
  const dns = dnsSaisi || gw;
  const hote = nomHote(vm);
  const listeA = useMemo(() => listeAdmins(admins), [admins]);
  const listeC = useMemo(() => listeCibles(cibles), [cibles]);
  const sansCle = listeA.filter(a => !a.cle);

  const soucis = useMemo(() => {
    const s: string[] = [];
    if (!ipValide(ip)) s.push(`« ${ip} » n'est pas une adresse IPv4.`);
    else if (!ipValide(gw)) s.push(`La passerelle « ${gw} » n'est pas une adresse IPv4.`);
    else if (reseauDe(ip, Number(cidr)) !== reseauDe(gw, Number(cidr))) s.push(`La passerelle ${gw} est hors du sous-réseau ${ip}/${cidr}.`);
    if (!ipValide(dns)) s.push(`Le DNS « ${dns} » n'est pas une adresse IPv4.`);
    if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) s.push('Le port SSH doit être un nombre entre 1 et 65535.');
    if (!listeA.length) s.push('Au moins un administrateur (login en minuscules, puis sa clé publique sur la même ligne).');
    if (!listeC.length) s.push('Au moins un serveur à mettre derrière le bastion (« nom ip » par ligne).');
    if (listeC.some(c => c.ip === ip)) s.push('Un serveur cible a l’adresse du bastion.');
    if (auth === 'cle' && listeA.length && !listeA.some(a => a.cle) && !genererCles) s.push('Mode « clé seulement » sans aucune clé : colle les clés publiques, coche « Générer les clés pendant le script », ou choisis un mode avec mot de passe.');
    return s;
  }, [ip, gw, dns, cidr, port, listeA, listeC, auth, genererCles]);

  const params = useDeferredValue(useMemo(() => ({ hv, master, masterId, exportPath, vhdDir, sw, copierFichiers, vm, id, ip, cidr, gw, dns, iface, port, admins, cibles, auth, genererCles, mfa, fail2ban, mdpSysteme }),
    [hv, master, masterId, exportPath, vhdDir, sw, copierFichiers, vm, id, ip, cidr, gw, dns, iface, port, admins, cibles, auth, genererCles, mfa, fail2ban, mdpSysteme]));
  const sections = useMemo(() => genererScriptsBastion(params), [params]);

  // Ligne curl : le script deposé sur le site, et la commande qui le rapatrie dans la VM.
  const [depot, setDepot] = useState<Record<string, string>>({});
  const partager = async (sec: { id: string; code: string; fichier: string }) => {
    setDepot(d => ({ ...d, [sec.id]: 'en cours' }));
    try {
      const r = await deposerScript(sec.fichier, sec.code);
      setDepot(d => ({ ...d, [sec.id]: lignesRecuperation(r.url, sec.fichier, sec.id !== 'poste' && sec.id !== 'posteNix') }));
    } catch (e) {
      setDepot(d => ({ ...d, [sec.id]: 'ERREUR : ' + (e instanceof Error ? e.message : String(e)) }));
    }
  };

  const copier = async (cle: string, texte: string) => {
    const fini = () => { setCopie(cle); setTimeout(() => setCopie(''), 1600); };
    try { await navigator.clipboard.writeText(texte); fini(); return; } catch { /* repli */ }
    const ta = document.createElement('textarea');
    ta.value = texte; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    if (ok) { fini(); return; }
    const p = pres.current[cle.replace(/^console-/, '')];
    if (p) { const r = document.createRange(); r.selectNodeContents(p); const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(r); }
    setCopie('sel-' + cle); setTimeout(() => setCopie(''), 2500);
  };
  const telecharger = (texte: string, nom: string) => {
    const ps = nom.endsWith('.ps1');
    const blob = new Blob([ps ? '\uFEFF' + texte : texte.replace(/\r\n/g, '\n') + '\n'], { type: ps ? 'text/plain;charset=utf-8' : 'text/x-shellscript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = nom; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  return (
    <div style={{ margin: '14px 0' }}>
      <div style={groupe}>
        <div style={legende}>🧬 Hôte et master <span className="meta" style={{ fontWeight: 400 }}>(mêmes réglages que le configurateur duo web + base)</span></div>
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
            <input style={{ ...champ, ...mono }} value={master} onChange={e => persist('wdb_master', e.target.value, setMaster)} />
          </div>
          {hv === 'proxmox' && (
            <div>
              <label style={etiquette}>VMID du master</label>
              <input style={champ} value={masterId} onChange={e => persist('wdb_masterid', e.target.value.replace(/\D/g, ''), setMasterId)} />
            </div>
          )}
          <div>
            <label style={etiquette}>{hv === 'hyperv' ? 'Commutateur virtuel' : 'Pont (bridge)'}</label>
            <input style={champ} value={sw} onChange={e => persist('wdb_sw', e.target.value, setSw)} />
          </div>
        </div>
        {hv === 'hyperv' && (
          <div style={{ ...rangee, marginTop: 10 }}>
            <div><label style={etiquette}>Dossier d’export temporaire</label><input style={champ} value={exportPath} onChange={e => persist('wdb_export', e.target.value, setExportPath)} /></div>
            <div><label style={etiquette}>Dossier des VM clonées</label><input style={champ} value={vhdDir} onChange={e => persist('wdb_vhddir', e.target.value, setVhdDir)} /></div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, cursor: 'pointer', alignSelf: 'end', paddingBottom: 8 }}>
              <input type="checkbox" checked={copierFichiers} onChange={e => setCopierFichiers(e.target.checked)} /> Déposer le script dans la VM (Copy-VMFile)
            </label>
          </div>
        )}
      </div>

      <div style={groupe}>
        <div style={legende}>🛡️ Le bastion</div>
        <div style={rangee}>
          <div><label style={etiquette}>Nom de la VM</label><input style={{ ...champ, ...mono }} value={vm} onChange={e => setVm(e.target.value)} /></div>
          {hv === 'proxmox' && <div><label style={etiquette}>VMID</label><input style={champ} value={id} onChange={e => setId(e.target.value.replace(/\D/g, ''))} /></div>}
          <div><label style={etiquette}>Adresse IP (réseau d’administration)</label><input style={{ ...champ, ...mono }} value={ip} onChange={e => setIp(e.target.value.trim())} /></div>
          <div>
            <label style={etiquette}>Masque</label>
            <select style={champ} value={cidr} onChange={e => setCidr(e.target.value)}>{CIDRS.map(c => <option key={c} value={String(c)}>/{c} — {masqueDe(c)}</option>)}</select>
          </div>
          <div><label style={etiquette}>Passerelle {!gwSaisi && <span className="meta" style={{ fontWeight: 400 }}>(auto .254)</span>}</label><input style={{ ...champ, ...mono }} value={gw} onChange={e => setGw(e.target.value.trim())} /></div>
          <div><label style={etiquette}>DNS {!dnsSaisi && <span className="meta" style={{ fontWeight: 400 }}>(= passerelle)</span>}</label><input style={{ ...champ, ...mono }} value={dns} onChange={e => setDns(e.target.value.trim())} /></div>
          <div><label style={etiquette}>Port SSH</label><input style={{ ...champ, ...mono }} value={port} onChange={e => setPort(e.target.value.replace(/\D/g, ''))} /></div>
          <div><label style={etiquette}>Carte réseau {!iface && <span className="meta" style={{ fontWeight: 400 }}>(auto)</span>}</label><input style={{ ...champ, ...mono }} value={iface} onChange={e => setIface(e.target.value.trim())} placeholder="eth0" /></div>
        </div>
        <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>Nom d’hôte Linux : <code>{hote}</code>. 1 vCPU, 1 Go : un bastion ne fait qu’ouvrir des tunnels.</div>
      </div>

      <div style={rangee}>
        <div style={groupe}>
          <div style={legende}>👤 Administrateurs <span className="meta" style={{ fontWeight: 400 }}>(un par ligne : login, puis sa clé publique)</span></div>
          <textarea style={zone} value={admins} onChange={e => setAdmins(e.target.value)} spellCheck={false} />
          <div className="meta" style={{ fontSize: 11.5, marginTop: 6 }}>
            La clé vient de <code>~/.ssh/id_ed25519.pub</code> sur le poste (bloc ④ pour la générer). {listeA.length ? <>Reconnus : {listeA.map(a => <code key={a.login} style={{ marginRight: 4 }}>{a.login}{a.cle ? ' 🔑' : ''}</code>)}</> : 'Aucun administrateur reconnu.'}
            {sansCle.length > 0 && <> — sans clé collée : {sansCle.map(a => a.login).join(', ')}{genererCles ? ' (une clé sera fabriquée par le script)' : auth !== 'cle' ? ` (mot de passe ${MDP})` : ' (bloqués !)'}.</>}
            {genererCles && <> Les clés fabriquées sur le bastion sont affichées en fin de script et rangées dans <code>~/.ssh/cle-bastion-&lt;login&gt;</code> : chaque admin rapatrie sa clé privée sur son poste (<code>scp</code>), puis on l’efface du bastion ; pour les serveurs, le script imprime les <code>ssh-copy-id</code> à lancer avant ③.</>}
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-soft)', fontSize: 12.5 }}>SSH accepte :</span>
              {([['mdp', `mot de passe ${MDP}`], ['cle', 'clé seulement'], ['les-deux', 'les deux']] as [Auth, string][]).map(([v, l]) => (
                <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}><input type="radio" name="auth-bastion" checked={auth === v} onChange={() => setAuth(v)} /> {l}</label>
              ))}
            </span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, cursor: 'pointer' }}><input type="checkbox" checked={genererCles} onChange={e => setGenererCles(e.target.checked)} /> Générer les clés des administrateurs pendant le script (écrase les existantes)</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, cursor: 'pointer' }}><input type="checkbox" checked={mfa} onChange={e => setMfa(e.target.checked)} /> MFA : clé + code TOTP</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, cursor: 'pointer' }}><input type="checkbox" checked={fail2ban} onChange={e => setFail2ban(e.target.checked)} /> fail2ban</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, cursor: 'pointer' }}><input type="checkbox" checked={mdpSysteme} onChange={e => setMdpSysteme(e.target.checked)} /> root du bastion en {MDP} (console)</label>
          </div>
        </div>
        <div style={groupe}>
          <div style={legende}>🖥️ Serveurs derrière le bastion <span className="meta" style={{ fontWeight: 400 }}>(un par ligne : nom, IP)</span></div>
          <textarea style={zone} value={cibles} onChange={e => setCibles(e.target.value)} spellCheck={false} />
          <div className="meta" style={{ fontSize: 11.5, marginTop: 6 }}>
            {listeC.length ? <>Sur chacun, le script ③ crée les mêmes administrateurs et n’ouvre le port 22 qu’à <code>{ip}</code> : {listeC.map(c => <code key={c.nom} style={{ marginRight: 4 }}>{c.nom}</code>)}</> : 'Aucun serveur reconnu.'}
          </div>
        </div>
      </div>

      {soucis.length > 0 && (
        <aside className="pb-note pb-note-red" style={{ marginBottom: 14 }}>
          <p className="pb-note-title">🚫 À corriger avant de copier</p>
          <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>{soucis.map(s => <li key={s}>{s}</li>)}</ul>
        </aside>
      )}

      {sections.map(sec => (
        <div key={sec.id} style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 6px', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>📜 {sec.titre}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {sec.id !== 'verif' && (
                <button type="button" onClick={() => telecharger(sec.code, sec.fichier)} style={{ ...bouton, borderColor: 'var(--border)', color: 'var(--text)' }} title={`Télécharger ${sec.fichier}`}>💾 {sec.fichier.replace(/^.*\./, '.')}</button>
              )}
              {(sec.id === 'bastion' || sec.id === 'cibles') && (
                <button type="button" onClick={() => copier('console-' + sec.id, pourConsoleBastion(sec))} style={{ ...bouton, background: copie === 'console-' + sec.id ? 'var(--accent)' : 'transparent', color: copie === 'console-' + sec.id ? '#fff' : 'var(--accent)' }} title="Version qui s’enregistre dans /root et se lance : à coller telle quelle dans le terminal">
                  {copie === 'console-' + sec.id ? '✓ Copié' : '🖥️ Pour la console'}
                </button>
              )}
              {sec.id !== 'verif' && (
                <button type="button" onClick={() => partager(sec)} disabled={depot[sec.id] === 'en cours'} style={{ ...bouton, borderColor: 'var(--border)', color: 'var(--text)' }} title="Dépose le script sur le site (7 jours) et donne la ligne curl / wget à taper dans la VM">
                  {depot[sec.id] === 'en cours' ? '…' : '🔗 Ligne curl'}
                </button>
              )}
              <button type="button" onClick={() => copier(sec.id, sec.code)} style={{ ...bouton, background: copie === sec.id ? 'var(--accent)' : 'transparent', color: copie === sec.id ? '#fff' : 'var(--accent)' }}>
                {copie === sec.id ? '✓ Copié' : copie === 'sel-' + sec.id ? 'Sélectionné — Ctrl+C' : 'Copier'}
              </button>
            </div>
          </div>
          {depot[sec.id] && depot[sec.id] !== 'en cours' && (
            <div style={{ margin: '0 0 8px', border: '1px solid var(--accent)', borderRadius: 8, padding: '8px 10px', background: 'var(--surface)', fontSize: 12.5 }}>
              {depot[sec.id]!.startsWith('ERREUR') ? <span style={{ color: '#dc2626' }}>{depot[sec.id]}</span> : (
                <>
                  <div className="meta" style={{ fontSize: 11.5, marginBottom: 4 }}>À taper dans {sec.id === 'poste' ? 'PowerShell sur le poste' : 'la VM'} (valable 7 jours, le script est récupéré tel quel, aucun collage) :</div>
                  <pre style={{ ...pre, padding: '8px 10px', marginBottom: 6 }}><code>{depot[sec.id]}</code></pre>
                  <button type="button" onClick={() => copier('curl-' + sec.id, depot[sec.id]!)} style={{ ...bouton, padding: '4px 10px', fontSize: 12 }}>{copie === 'curl-' + sec.id ? '✓ Copié' : 'Copier la ligne'}</button>
                </>
              )}
            </div>
          )}
          <Bloc code={sec.code} refPre={el => { pres.current[sec.id] = el; }} />
        </div>
      ))}
    </div>
  );
}

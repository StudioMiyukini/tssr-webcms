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
import { useMemo, useState } from 'react';
import { MDP, genererScripts, nomHote, type Hyperviseur } from '@/lib/web-db-scripts';

const champ: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' };
const mono: React.CSSProperties = { fontFamily: "ui-monospace,'Space Mono',SFMono-Regular,Menlo,Consolas,monospace" };
const etiquette: React.CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 4 };
const groupe: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', background: 'var(--surface-2)', marginBottom: 14 };
const legende: React.CSSProperties = { fontWeight: 700, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const rangee: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 };
const bouton: React.CSSProperties = { padding: '6px 14px', border: '1px solid var(--accent)', borderRadius: 8, background: 'transparent', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' };
const pre: React.CSSProperties = { ...mono, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', overflowX: 'auto', fontSize: 12.5, lineHeight: 1.55, margin: 0, whiteSpace: 'pre' };

const lsGet = (k: string, d: string) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* indisponible */ } };

const IP_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const ipValide = (s: string) => IP_RE.test(s);
const reseauDe = (ip: string, cidr: number) => {
  const n = ip.split('.').map(Number).reduce((a, b) => (a << 8) + b, 0) >>> 0;
  const masque = cidr === 0 ? 0 : (0xffffffff << (32 - cidr)) >>> 0;
  return (n & masque) >>> 0;
};
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
  const [ipWeb, setIpWeb] = useState('192.168.10.21');
  const [ipBdd, setIpBdd] = useState('192.168.10.22');
  const [cidr, setCidr] = useState('24');
  const [gw, setGw] = useState('');
  const [dns, setDns] = useState('192.168.10.254');
  const [iface, setIface] = useState('');
  // --- Application ---
  const [bdd, setBdd] = useState('appdb');
  const [utilisateur, setUtilisateur] = useState('appuser');
  const [nodeSource, setNodeSource] = useState(false);
  const [mdpSysteme, setMdpSysteme] = useState(true);
  const [copie, setCopie] = useState('');

  const persist = (k: string, v: string, set: (v: string) => void) => { set(v); lsSet(k, v); };

  const cidrN = Number(cidr) || 24;
  const passerelle = gw || passerelleDe(ipWeb);
  const hoteWeb = nomHote(vmWeb);
  const hoteBdd = nomHote(vmBdd);

  // Les fautes que la syntaxe ne signale pas : c'est là qu'on perd une heure.
  const soucis = useMemo(() => {
    const s: string[] = [];
    for (const [nom, ip] of [['web', ipWeb], ['base', ipBdd], ['passerelle', passerelle], ['DNS', dns]] as const) {
      if (!ipValide(ip)) s.push(`L'adresse ${nom} « ${ip} » n'est pas une adresse IPv4.`);
    }
    if (ipValide(ipWeb) && ipValide(ipBdd)) {
      if (ipWeb === ipBdd) s.push('Les deux VM ont la même adresse : la seconde à démarrer sera injoignable.');
      else if (reseauDe(ipWeb, cidrN) !== reseauDe(ipBdd, cidrN)) s.push(`Les deux VM ne sont pas dans le même sous-réseau (/${cidr}) : le moteur ne joindra la base qu'à travers un routeur.`);
    }
    if (ipValide(ipWeb) && ipValide(passerelle) && reseauDe(ipWeb, cidrN) !== reseauDe(passerelle, cidrN)) s.push('La passerelle est hors du sous-réseau des VM : pas de sortie (apt et npm échoueront).');
    if (vmWeb.trim() === vmBdd.trim()) s.push('Les deux VM portent le même nom.');
    if (hv === 'proxmox' && idWeb === idBdd) s.push('Les deux VM Proxmox ont le même identifiant.');
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(bdd)) s.push('Le nom de la base : lettres, chiffres et _ seulement.');
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(utilisateur)) s.push('Le nom d’utilisateur MariaDB : lettres, chiffres et _ (32 caractères max).');
    return s;
  }, [ipWeb, ipBdd, passerelle, dns, cidr, cidrN, vmWeb, vmBdd, hv, idWeb, idBdd, bdd, utilisateur]);

  const sections = useMemo(() => genererScripts({ hv, master, masterId, exportPath, vhdDir, sw, copierFichiers, vmWeb, vmBdd, idWeb, idBdd, vcpu, ram, ipWeb, ipBdd, cidr, passerelle, dns, iface, bdd, utilisateur, nodeSource, mdpSysteme }),
    [hv, master, masterId, exportPath, vhdDir, sw, copierFichiers, vmWeb, vmBdd, idWeb, idBdd, vcpu, ram, ipWeb, ipBdd, cidr, passerelle, dns, iface, bdd, utilisateur, nodeSource, mdpSysteme]);

  const copier = (id: string, texte: string) => {
    navigator.clipboard?.writeText(texte).then(() => { setCopie(id); setTimeout(() => setCopie(''), 1600); }).catch(() => { /* le texte reste sélectionnable */ });
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
              <input style={{ ...champ, ...mono }} value={ipWeb} onChange={e => setIpWeb(e.target.value)} />
            </div>
            {hv === 'proxmox' && (
              <div>
                <label style={etiquette}>VMID</label>
                <input style={champ} value={idWeb} onChange={e => setIdWeb(e.target.value.replace(/\D/g, ''))} />
              </div>
            )}
          </div>
          <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>Nom d’hôte Linux : <code>{hoteWeb}</code></div>
        </div>
        {/* VM base */}
        <div style={groupe}>
          <div style={legende}>🟣 VM 2 — base de données (MariaDB)</div>
          <label style={etiquette}>Nom de la VM</label>
          <input style={{ ...champ, ...mono }} value={vmBdd} onChange={e => setVmBdd(e.target.value)} />
          <div style={{ ...rangee, marginTop: 10 }}>
            <div>
              <label style={etiquette}>Adresse IP</label>
              <input style={{ ...champ, ...mono }} value={ipBdd} onChange={e => setIpBdd(e.target.value)} />
            </div>
            {hv === 'proxmox' && (
              <div>
                <label style={etiquette}>VMID</label>
                <input style={champ} value={idBdd} onChange={e => setIdBdd(e.target.value.replace(/\D/g, ''))} />
              </div>
            )}
          </div>
          <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>Nom d’hôte Linux : <code>{hoteBdd}</code></div>
        </div>
      </div>

      {/* Réseau commun */}
      <div style={groupe}>
        <div style={legende}>🌐 Réseau (commun aux deux VM)</div>
        <div style={rangee}>
          <div>
            <label style={etiquette}>Masque (CIDR)</label>
            <select style={champ} value={cidr} onChange={e => setCidr(e.target.value)}>
              {[16, 22, 23, 24, 25, 26, 27, 28].map(c => <option key={c} value={String(c)}>/{c} — {masqueDe(c)}</option>)}
            </select>
          </div>
          <div>
            <label style={etiquette}>Passerelle {!gw && <span className="meta" style={{ fontWeight: 400 }}>(auto .254)</span>}</label>
            <input style={{ ...champ, ...mono }} value={passerelle} onChange={e => setGw(e.target.value)} />
          </div>
          <div>
            <label style={etiquette}>DNS</label>
            <input style={{ ...champ, ...mono }} value={dns} onChange={e => setDns(e.target.value)} />
          </div>
          <div>
            <label style={etiquette}>Carte réseau {!iface && <span className="meta" style={{ fontWeight: 400 }}>(auto-détectée)</span>}</label>
            <input style={{ ...champ, ...mono }} value={iface} onChange={e => setIface(e.target.value.trim())} placeholder="eth0" />
          </div>
        </div>
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
              <button type="button" onClick={() => copier(sec.id, sec.code)} style={{ ...bouton, background: copie === sec.id ? 'var(--accent)' : 'transparent', color: copie === sec.id ? '#fff' : 'var(--accent)' }}>
                {copie === sec.id ? '✓ Copié' : 'Copier'}
              </button>
            </div>
          </div>
          <pre style={pre}><code>{sec.code}</code></pre>
        </div>
      ))}
    </div>
  );
}

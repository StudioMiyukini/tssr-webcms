/**
 * Configurateur « serveur web nginx + MariaDB » — îlot React
 * (data-block="nginx-mariadb-configurator").
 *
 * Installe une pile LEMP (nginx + PHP + MariaDB) sur une ou deux VM Debian, avec
 * l'adressage, l'enregistrement DNS du site, le port forwarding pour le publier,
 * et le renvoi au configurateur de load balancer quand on met le site en frontal.
 *
 * Même famille que les configurateurs BIND9 / duo / load balancer : mêmes
 * briques de script (identité du clone, adresse fixe, séquence réseau) et mêmes
 * boutons.
 */
import { memo, useDeferredValue, useMemo, useRef, useState } from 'react';
import { deposerScript, lignesRecuperation } from '@/lib/partage-script';
import { MDP } from '@/lib/web-db-scripts';
import {
  genererNd, pourConsoleNd, ipValide, fqdnValide,
  type ParamsNd, type VarianteFw, type ModeDns,
} from '@/lib/nginx-mariadb-scripts';

const champ: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' };
const mono: React.CSSProperties = { fontFamily: "ui-monospace,'Space Mono',SFMono-Regular,Menlo,Consolas,monospace" };
const etiquette: React.CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 4 };
const groupe: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', background: 'var(--surface-2)', marginBottom: 14 };
const legende: React.CSSProperties = { fontWeight: 700, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const rangee: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 };
const bouton: React.CSSProperties = { padding: '6px 14px', border: '1px solid var(--accent)', borderRadius: 8, background: 'transparent', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' };
const pre: React.CSSProperties = { ...mono, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', overflowX: 'auto', fontSize: 12.5, lineHeight: 1.55, margin: 0, whiteSpace: 'pre' };
const check: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, cursor: 'pointer' };
const CIDRS = [8, 16, 22, 23, 24, 25, 26, 27, 28];

const lsGet = (k: string, d: string) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* indisponible */ } };
const lsGetB = (k: string, d: boolean) => { try { const v = localStorage.getItem(k); return v === null ? d : v === '1'; } catch { return d; } };
const lsSetB = (k: string, v: boolean) => { try { localStorage.setItem(k, v ? '1' : '0'); } catch { /* indisponible */ } };
const passerelleDe = (ip: string) => { const m = ip.match(/^(\d+\.\d+\.\d+)\.\d+$/); return m ? `${m[1]}.254` : ''; };
const reseauDe = (ip: string, cidr: number) => { const n = ip.split('.').map(Number).reduce((a, b) => (a << 8) + b, 0) >>> 0; const m = cidr === 0 ? 0 : (0xffffffff << (32 - cidr)) >>> 0; return (n & m) >>> 0; };

const Bloc = memo(function Bloc({ code, refPre }: { code: string; refPre: (el: HTMLPreElement | null) => void }) {
  return <pre ref={refPre} style={pre} tabIndex={0}><code>{code}</code></pre>;
});

/*
 * @id     tssr.atelier.nginxMariadbConfigurator
 * @do     configurer_serveur_web_nginx_mariadb
 * @role   ui
 * @layer  ui
 * @human  Atelier : serveur web nginx + MariaDB (1 ou 2 machines, DNS, port forward, load balancer).
 */
export function NginxMariadbConfigurator() {
  const [separe, setSepare] = useState(() => lsGetB('nd_separe', true));
  // Web
  const [vmWeb, setVmWeb] = useState(() => lsGet('nd_vmweb', 'SRV_WEB_01'));
  const [ipWeb, setIpWeb] = useState(() => lsGet('nd_ipweb', '10.180.30.10'));
  const [cidrWeb, setCidrWeb] = useState(() => lsGet('nd_cidrweb', '24'));
  const [gwWeb, setGwWeb] = useState(() => lsGet('nd_gwweb', ''));
  const [dnsWeb, setDnsWeb] = useState(() => lsGet('nd_dnsweb', ''));
  const [ifaceWeb, setIfaceWeb] = useState(() => lsGet('nd_ifweb', ''));
  const [domaine, setDomaine] = useState(() => lsGet('nd_dom', 'www.entreprise.lan'));
  const [mdpSysteme, setMdpSysteme] = useState(true);
  // Base
  const [vmBdd, setVmBdd] = useState(() => lsGet('nd_vmbdd', 'SRV_BDD_01'));
  const [ipBdd, setIpBdd] = useState(() => lsGet('nd_ipbdd', '10.180.10.20'));
  const [cidrBdd, setCidrBdd] = useState(() => lsGet('nd_cidrbdd', '24'));
  const [gwBdd, setGwBdd] = useState(() => lsGet('nd_gwbdd', ''));
  const [dnsBdd, setDnsBdd] = useState(() => lsGet('nd_dnsbdd', ''));
  const [ifaceBdd, setIfaceBdd] = useState(() => lsGet('nd_ifbdd', ''));
  const [bdd, setBdd] = useState(() => lsGet('nd_bdd', 'appdb'));
  const [dbUser, setDbUser] = useState(() => lsGet('nd_dbuser', 'appuser'));
  // DNS
  const [dns, setDns] = useState(() => lsGetB('nd_dns', true));
  const [dnsMode, setDnsMode] = useState<ModeDns>(() => (lsGet('nd_dnsmode', 'bind') as ModeDns));
  const [dnsServeur, setDnsServeur] = useState(() => lsGet('nd_dnssrv', '10.180.10.1'));
  // Port forwarding
  const [pf, setPf] = useState(() => lsGetB('nd_pf', false));
  const [pfVariante, setPfVariante] = useState<VarianteFw>(() => (lsGet('nd_pfvar', 'pfsense') as VarianteFw));
  const [pfWan, setPfWan] = useState(() => lsGet('nd_pfwan', '10.22.10.65'));
  const [pfWanIf, setPfWanIf] = useState(() => lsGet('nd_pfwanif', 'GigabitEthernet0/1'));
  const [pfPorts, setPfPorts] = useState(() => lsGet('nd_pfports', '80,443'));
  // Load balancer
  const [lb, setLb] = useState(() => lsGetB('nd_lb', false));
  const [lbIp, setLbIp] = useState(() => lsGet('nd_lbip', '10.180.30.5'));
  const [copie, setCopie] = useState('');
  const pres = useRef<Record<string, HTMLPreElement | null>>({});

  const persist = (k: string, v: string, set: (v: string) => void) => { set(v); lsSet(k, v); };

  const soucis = useMemo(() => {
    const s: string[] = [];
    if (!ipValide(ipWeb)) s.push(`L'IP du serveur web « ${ipWeb} » n'est pas une adresse IPv4.`);
    if (!fqdnValide(domaine)) s.push(`« ${domaine} » n'est pas un nom de domaine valide (ex. www.entreprise.lan).`);
    if (separe) {
      if (!ipValide(ipBdd)) s.push(`L'IP du serveur MariaDB « ${ipBdd} » n'est pas une adresse IPv4.`);
      if (ipValide(ipBdd) && ipBdd.trim() === ipWeb.trim()) s.push('Les deux serveurs ont la même IP.');
    }
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(bdd.trim())) s.push('Le nom de base doit commencer par une lettre (lettres, chiffres, _).');
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(dbUser.trim())) s.push("Le nom d'utilisateur SQL doit commencer par une lettre.");
    if (pf && pfVariante !== 'cisco' && !ipValide(pfWan)) s.push(`L'IP WAN « ${pfWan} » n'est pas une adresse IPv4.`);
    if (lb && !ipValide(lbIp)) s.push(`L'IP du load balancer « ${lbIp} » n'est pas une adresse IPv4.`);
    if (lb && ipValide(lbIp) && ipValide(ipWeb) && reseauDe(lbIp, 24) !== reseauDe(ipWeb, 24)) s.push('Le load balancer et le serveur web ne sont pas dans le même /24 — vérifie le routage entre eux.');
    return s;
  }, [ipWeb, domaine, separe, ipBdd, bdd, dbUser, pf, pfVariante, pfWan, lb, lbIp]);

  const params = useDeferredValue(useMemo<ParamsNd>(() => ({
    separe,
    vmWeb, ipWeb, cidrWeb, gwWeb: gwWeb || passerelleDe(ipWeb), dnsWeb, ifaceWeb, domaine: domaine.trim().toLowerCase(), mdpSysteme,
    vmBdd, ipBdd, cidrBdd, gwBdd: gwBdd || passerelleDe(ipBdd), dnsBdd, ifaceBdd, bdd: bdd.trim(), dbUser: dbUser.trim(),
    dns, dnsMode, dnsServeur,
    pf, pfVariante, pfWan, pfWanIf, pfPorts,
    lb, lbIp,
  }), [separe, vmWeb, ipWeb, cidrWeb, gwWeb, dnsWeb, ifaceWeb, domaine, mdpSysteme, vmBdd, ipBdd, cidrBdd, gwBdd, dnsBdd, ifaceBdd, bdd, dbUser, dns, dnsMode, dnsServeur, pf, pfVariante, pfWan, pfWanIf, pfPorts, lb, lbIp]));
  const sections = useMemo(() => genererNd(params), [params]);

  const [depot, setDepot] = useState<Record<string, string>>({});
  const partager = async (sec: { id: string; code: string }) => {
    setDepot(d => ({ ...d, [sec.id]: 'en cours' }));
    try {
      const fichier = sec.id === 'web' ? 'serveur-web.sh' : 'serveur-bdd.sh';
      const r = await deposerScript(fichier, sec.code);
      setDepot(d => ({ ...d, [sec.id]: lignesRecuperation(r.url, fichier, true) }));
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
    const blob = new Blob([texte.replace(/\r\n/g, '\n') + '\n'], { type: 'text/x-shellscript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = nom; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  return (
    <div style={{ margin: '14px 0' }}>
      <div style={groupe}>
        <div style={legende}>🌐 Le serveur web (nginx + PHP)</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
          <label style={check}><input type="checkbox" checked={separe} onChange={e => { setSepare(e.target.checked); lsSetB('nd_separe', e.target.checked); }} /> nginx &amp; MariaDB sur <strong>2 machines</strong> <span className="meta">(décoché = tout sur une seule)</span></label>
          <label style={check}><input type="checkbox" checked={mdpSysteme} onChange={e => setMdpSysteme(e.target.checked)} /> root en {MDP}</label>
        </div>
        <div style={rangee}>
          <div><label style={etiquette}>Nom de la VM</label><input style={champ} value={vmWeb} onChange={e => persist('nd_vmweb', e.target.value, setVmWeb)} placeholder="SRV_WEB_01" /></div>
          <div><label style={etiquette}>Adresse IP</label><input style={{ ...champ, ...mono }} value={ipWeb} onChange={e => persist('nd_ipweb', e.target.value, setIpWeb)} placeholder="10.180.30.10" /></div>
          <div><label style={etiquette}>Masque</label><select style={champ} value={cidrWeb} onChange={e => persist('nd_cidrweb', e.target.value, setCidrWeb)}>{CIDRS.map(c => <option key={c} value={c}>/{c}</option>)}</select></div>
          <div><label style={etiquette}>Passerelle <span className="meta" style={{ fontWeight: 400 }}>(auto .254)</span></label><input style={{ ...champ, ...mono }} value={gwWeb} onChange={e => persist('nd_gwweb', e.target.value, setGwWeb)} placeholder={passerelleDe(ipWeb) || '10.180.30.254'} /></div>
          <div><label style={etiquette}>DNS <span className="meta" style={{ fontWeight: 400 }}>(défaut : passerelle)</span></label><input style={{ ...champ, ...mono }} value={dnsWeb} onChange={e => persist('nd_dnsweb', e.target.value, setDnsWeb)} placeholder="10.180.10.1" /></div>
          <div><label style={etiquette}>Nom du site (FQDN)</label><input style={{ ...champ, ...mono }} value={domaine} onChange={e => persist('nd_dom', e.target.value, setDomaine)} placeholder="www.entreprise.lan" /></div>
        </div>
      </div>

      <div style={groupe}>
        <div style={legende}>🗄️ La base MariaDB {!separe && <span className="meta" style={{ fontWeight: 400 }}>(sur la même machine que nginx)</span>}</div>
        <div style={rangee}>
          <div><label style={etiquette}>Base de données</label><input style={{ ...champ, ...mono }} value={bdd} onChange={e => persist('nd_bdd', e.target.value, setBdd)} placeholder="appdb" /></div>
          <div><label style={etiquette}>Utilisateur SQL</label><input style={{ ...champ, ...mono }} value={dbUser} onChange={e => persist('nd_dbuser', e.target.value, setDbUser)} placeholder="appuser" /></div>
        </div>
        {separe && (
          <div style={{ ...rangee, marginTop: 12 }}>
            <div><label style={etiquette}>Nom de la VM base</label><input style={champ} value={vmBdd} onChange={e => persist('nd_vmbdd', e.target.value, setVmBdd)} placeholder="SRV_BDD_01" /></div>
            <div><label style={etiquette}>Adresse IP base</label><input style={{ ...champ, ...mono }} value={ipBdd} onChange={e => persist('nd_ipbdd', e.target.value, setIpBdd)} placeholder="10.180.10.20" /></div>
            <div><label style={etiquette}>Masque</label><select style={champ} value={cidrBdd} onChange={e => persist('nd_cidrbdd', e.target.value, setCidrBdd)}>{CIDRS.map(c => <option key={c} value={c}>/{c}</option>)}</select></div>
            <div><label style={etiquette}>Passerelle <span className="meta" style={{ fontWeight: 400 }}>(auto .254)</span></label><input style={{ ...champ, ...mono }} value={gwBdd} onChange={e => persist('nd_gwbdd', e.target.value, setGwBdd)} placeholder={passerelleDe(ipBdd) || '10.180.10.254'} /></div>
          </div>
        )}
        <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>
          {separe
            ? <>MariaDB écoute sur le réseau et n’autorise <code>{dbUser}</code> que depuis <code>{ipWeb}</code> (le serveur web). Le port 3306 n’est ouvert que pour lui.</>
            : <>Tout sur une seule VM : MariaDB reste en écoute locale (<code>127.0.0.1</code>), <code>{dbUser}</code> est un compte <code>localhost</code>. Plus simple, mais pas de séparation des rôles.</>}
        </div>
      </div>

      <div style={groupe}>
        <div style={legende}>🌍 DNS <label style={{ ...check, fontWeight: 400, marginLeft: 8 }}><input type="checkbox" checked={dns} onChange={e => { setDns(e.target.checked); lsSetB('nd_dns', e.target.checked); }} /> générer l’enregistrement</label></div>
        {dns && (
          <div style={rangee}>
            <div><label style={etiquette}>Type de serveur DNS</label><select style={champ} value={dnsMode} onChange={e => persist('nd_dnsmode', e.target.value, v => setDnsMode(v as ModeDns))}><option value="bind">BIND9 (Linux)</option><option value="windows">Windows / AD</option><option value="hosts">Aucun (/etc/hosts)</option></select></div>
            {dnsMode !== 'hosts' && <div><label style={etiquette}>IP du serveur DNS</label><input style={{ ...champ, ...mono }} value={dnsServeur} onChange={e => persist('nd_dnssrv', e.target.value, setDnsServeur)} placeholder="10.180.10.1" /></div>}
          </div>
        )}
      </div>

      <div style={groupe}>
        <div style={legende}>🚪 Port forwarding <label style={{ ...check, fontWeight: 400, marginLeft: 8 }}><input type="checkbox" checked={pf} onChange={e => { setPf(e.target.checked); lsSetB('nd_pf', e.target.checked); }} /> publier le site depuis le WAN</label></div>
        {pf && (
          <div style={rangee}>
            <div><label style={etiquette}>Pare-feu</label><select style={champ} value={pfVariante} onChange={e => persist('nd_pfvar', e.target.value, v => setPfVariante(v as VarianteFw))}><option value="pfsense">pfSense</option><option value="opnsense">OPNsense</option><option value="cisco">Cisco IOS</option></select></div>
            {pfVariante !== 'cisco' && <div><label style={etiquette}>IP WAN publique</label><input style={{ ...champ, ...mono }} value={pfWan} onChange={e => persist('nd_pfwan', e.target.value, setPfWan)} placeholder="10.22.10.65" /></div>}
            {pfVariante === 'cisco' && <><div><label style={etiquette}>IP WAN</label><input style={{ ...champ, ...mono }} value={pfWan} onChange={e => persist('nd_pfwan', e.target.value, setPfWan)} placeholder="10.22.10.65" /></div><div><label style={etiquette}>Interface WAN</label><input style={{ ...champ, ...mono }} value={pfWanIf} onChange={e => persist('nd_pfwanif', e.target.value, setPfWanIf)} placeholder="GigabitEthernet0/1" /></div></>}
            <div><label style={etiquette}>Ports</label><input style={{ ...champ, ...mono }} value={pfPorts} onChange={e => persist('nd_pfports', e.target.value, setPfPorts)} placeholder="80,443" /></div>
          </div>
        )}
      </div>

      <div style={groupe}>
        <div style={legende}>⚖️ Load balancer <label style={{ ...check, fontWeight: 400, marginLeft: 8 }}><input type="checkbox" checked={lb} onChange={e => { setLb(e.target.checked); lsSetB('nd_lb', e.target.checked); }} /> mettre le site derrière un répartiteur</label></div>
        {lb && (
          <>
            <div style={rangee}>
              <div><label style={etiquette}>IP du load balancer</label><input style={{ ...champ, ...mono }} value={lbIp} onChange={e => persist('nd_lbip', e.target.value, setLbIp)} placeholder="10.180.30.5" /></div>
            </div>
            <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>
              Ce serveur devient un <strong>backend</strong> ; DNS et port-forward pointent vers le LB. Le répartiteur complet (health checks, HTTPS, keepalived) se génère avec le <a href="/pages/configurateur-loadbalancer" target="_blank" rel="noopener noreferrer">configurateur de load balancer</a> — ici on ne fournit que le bloc <code>upstream</code> à y coller.
            </div>
          </>
        )}
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
              {sec.script && <button type="button" onClick={() => telecharger(sec.code, sec.id === 'web' ? 'serveur-web.sh' : 'serveur-bdd.sh')} style={{ ...bouton, borderColor: 'var(--border)', color: 'var(--text)' }}>💾 .sh</button>}
              {sec.script && <button type="button" onClick={() => copier('console-' + sec.id, pourConsoleNd(sec))} style={{ ...bouton, background: copie === 'console-' + sec.id ? 'var(--accent)' : 'transparent', color: copie === 'console-' + sec.id ? '#fff' : 'var(--accent)' }} title="Version qui s’enregistre dans ~/ et se lance">{copie === 'console-' + sec.id ? '✓ Copié' : '🖥️ Pour la console'}</button>}
              {sec.script && <button type="button" onClick={() => partager(sec)} disabled={depot[sec.id] === 'en cours'} style={{ ...bouton, borderColor: 'var(--border)', color: 'var(--text)' }} title="Dépose le script sur le site (7 jours) et donne la ligne curl">{depot[sec.id] === 'en cours' ? '…' : '🔗 Ligne curl'}</button>}
              <button type="button" onClick={() => copier(sec.id, sec.code)} style={{ ...bouton, background: copie === sec.id ? 'var(--accent)' : 'transparent', color: copie === sec.id ? '#fff' : 'var(--accent)' }}>{copie === sec.id ? '✓ Copié' : copie === 'sel-' + sec.id ? 'Sélectionné — Ctrl+C' : 'Copier'}</button>
            </div>
          </div>
          {depot[sec.id] && depot[sec.id] !== 'en cours' && (
            <div style={{ margin: '0 0 8px', border: '1px solid var(--accent)', borderRadius: 8, padding: '8px 10px', background: 'var(--surface)', fontSize: 12.5 }}>
              {depot[sec.id]!.startsWith('ERREUR') ? <span style={{ color: '#dc2626' }}>{depot[sec.id]}</span> : (
                <>
                  <div className="meta" style={{ fontSize: 11.5, marginBottom: 4 }}>À taper dans la VM (valable 7 jours) :</div>
                  <pre style={{ ...pre, padding: '8px 10px', marginBottom: 6 }}><code>{depot[sec.id]}</code></pre>
                  <button type="button" onClick={() => copier('curl-' + sec.id, depot[sec.id]!)} style={{ ...bouton, padding: '4px 10px', fontSize: 12 }}>{copie === 'curl-' + sec.id ? '✓ Copié' : 'Copier la ligne'}</button>
                </>
              )}
            </div>
          )}
          <Bloc code={sec.code} refPre={el => { pres.current[sec.id] = el; }} />
        </div>
      ))}

      <div className="meta" style={{ fontSize: 11.5, marginTop: 10 }}>
        Pile <strong>LEMP</strong> : nginx sert le site et exécute PHP (php-fpm) ; PHP se connecte à MariaDB. En 2 machines, la base est isolée sur le réseau serveur et n’accepte que le serveur web. La page <code>index.php</code> de test affiche l’état de la connexion à la base. Voir aussi le <a href="/pages/procedure-apache-linux">pas à pas Apache</a> et le <a href="/pages/configurateur-loadbalancer">load balancer</a>.
      </div>
    </div>
  );
}

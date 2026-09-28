/**
 * Configurateur « load balancer nginx » — îlot React (data-block="loadbalancer-configurator").
 *
 * À partir d'une IP de répartiteur, d'un réseau, d'une liste de backends et d'un
 * algorithme, produit le script d'installation d'un load balancer nginx (bloc
 * upstream + serveur proxy, health checks passifs, serveur de secours,
 * persistance, stub_status, terminaison TLS), un script keepalived pour la
 * haute disponibilité (IP virtuelle) quand une VIP est donnée, et un bloc de
 * vérification.
 *
 * Même famille que les configurateurs BIND9 / duo / bastion : mêmes briques de
 * script (identité du clone, adresse fixe, séquence réseau) et mêmes boutons.
 */
import { memo, useDeferredValue, useMemo, useRef, useState } from 'react';
import { deposerScript, lignesRecuperation } from '@/lib/partage-script';
import { MDP } from '@/lib/web-db-scripts';
import {
  genererScriptsLb, listeBackends, ipValide, pourConsoleLb, libelleAlgo,
  type ParamsLb, type Algo,
} from '@/lib/loadbalancer-scripts';

const champ: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' };
const mono: React.CSSProperties = { fontFamily: "ui-monospace,'Space Mono',SFMono-Regular,Menlo,Consolas,monospace" };
const etiquette: React.CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 4 };
const groupe: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', background: 'var(--surface-2)', marginBottom: 14 };
const legende: React.CSSProperties = { fontWeight: 700, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const rangee: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 };
const bouton: React.CSSProperties = { padding: '6px 14px', border: '1px solid var(--accent)', borderRadius: 8, background: 'transparent', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' };
const pre: React.CSSProperties = { ...mono, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', overflowX: 'auto', fontSize: 12.5, lineHeight: 1.55, margin: 0, whiteSpace: 'pre' };
const zone: React.CSSProperties = { ...champ, ...mono, minHeight: 90, resize: 'vertical', fontSize: 12.5 };
const CIDRS = [8, 16, 22, 23, 24, 25, 26, 27, 28];
const ALGOS: Algo[] = ['roundrobin', 'least_conn', 'ip_hash'];

const lsGet = (k: string, d: string) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* indisponible */ } };
const lsGetB = (k: string, d: boolean) => { try { const v = localStorage.getItem(k); return v === null ? d : v === '1'; } catch { return d; } };
const lsSetB = (k: string, v: boolean) => { try { localStorage.setItem(k, v ? '1' : '0'); } catch { /* indisponible */ } };
const reseauDe = (ip: string, cidr: number) => { const n = ip.split('.').map(Number).reduce((a, b) => (a << 8) + b, 0) >>> 0; const m = cidr === 0 ? 0 : (0xffffffff << (32 - cidr)) >>> 0; return (n & m) >>> 0; };
const passerelleDe = (ip: string) => { const m = ip.match(/^(\d+\.\d+\.\d+)\.\d+$/); return m ? `${m[1]}.254` : ''; };

const Bloc = memo(function Bloc({ code, refPre }: { code: string; refPre: (el: HTMLPreElement | null) => void }) {
  return <pre ref={refPre} style={pre} tabIndex={0}><code>{code}</code></pre>;
});

/*
 * @id     tssr.atelier.loadBalancerConfigurator
 * @do     configurer_loadbalancer_nginx
 * @role   ui
 * @layer  ui
 * @human  Atelier : load balancer nginx (upstream, health checks, TLS, keepalived/VIP).
 */
export function LoadBalancerConfigurator() {
  const [vm, setVm] = useState(() => lsGet('lb_vm', 'SRV_LB_01'));
  const [ip, setIp] = useState(() => lsGet('lb_ip', '10.180.30.10'));
  const [cidr, setCidr] = useState(() => lsGet('lb_cidr', '24'));
  const [gwSaisi, setGw] = useState(() => lsGet('lb_gw', ''));
  const [dns, setDns] = useState(() => lsGet('lb_dns', ''));
  const [iface, setIface] = useState(() => lsGet('lb_iface', ''));
  const [mdpSysteme, setMdpSysteme] = useState(true);
  const [serverName, setServerName] = useState(() => lsGet('lb_sn', '_'));
  const [algo, setAlgo] = useState<Algo>(() => (lsGet('lb_algo', 'roundrobin') as Algo));
  const [backends, setBackends] = useState(() => lsGet('lb_be', '10.180.30.11\n10.180.30.12\n10.160.30.2 backup'));
  const [maxFails, setMaxFails] = useState(() => lsGet('lb_mf', '3'));
  const [failTimeout, setFailTimeout] = useState(() => lsGet('lb_ft', '10'));
  const [tls, setTls] = useState(() => lsGetB('lb_tls', false));
  const [status, setStatus] = useState(() => lsGetB('lb_status', true));
  const [statusAllow, setStatusAllow] = useState(() => lsGet('lb_sa', '10.180.0.0/16'));
  const [vip, setVip] = useState(() => lsGet('lb_vip', ''));
  const [ifaceHa, setIfaceHa] = useState(() => lsGet('lb_ifha', ''));
  const [role, setRole] = useState<'MASTER' | 'BACKUP'>(() => (lsGet('lb_role', 'MASTER') as 'MASTER' | 'BACKUP'));
  const [copie, setCopie] = useState('');
  const pres = useRef<Record<string, HTMLPreElement | null>>({});

  const persist = (k: string, v: string, set: (v: string) => void) => { set(v); lsSet(k, v); };
  const gw = gwSaisi || passerelleDe(ip);
  const be = useMemo(() => listeBackends(backends), [backends]);

  const soucis = useMemo(() => {
    const s: string[] = [];
    if (!ipValide(ip)) s.push(`« ${ip} » n'est pas une adresse IPv4.`);
    else if (gw && !ipValide(gw)) s.push(`La passerelle « ${gw} » n'est pas une adresse IPv4.`);
    else if (gw && reseauDe(ip, Number(cidr)) !== reseauDe(gw, Number(cidr))) s.push(`La passerelle ${gw} est hors du sous-réseau ${ip}/${cidr}.`);
    if (dns.trim() && !ipValide(dns)) s.push(`Le DNS « ${dns} » n'est pas une adresse IPv4.`);
    if (!be.length) s.push('Aucun backend valide (une ligne « ip[:port] [weight=N] [backup] »).');
    if (be.length && be.every(b => b.backup)) s.push('Tous les backends sont en « backup » : il n’y a aucun serveur principal.');
    if (vip.trim() && !ipValide(vip)) s.push(`L'IP virtuelle « ${vip} » n'est pas une adresse IPv4.`);
    if (ipValide(vip) && vip.trim() === ip.trim()) s.push('L’IP virtuelle est identique à l’IP du load balancer.');
    return s;
  }, [ip, gw, cidr, dns, be, vip]);

  const params = useDeferredValue(useMemo<ParamsLb>(() => ({
    vm, ip, cidr, gw, dns: dns.trim(), iface, mdpSysteme,
    serverName: serverName.trim() || '_', algo, backends, maxFails, failTimeout,
    tls, status, statusAllow, vip: vip.trim(), ifaceHa, role,
  }), [vm, ip, cidr, gw, dns, iface, mdpSysteme, serverName, algo, backends, maxFails, failTimeout, tls, status, statusAllow, vip, ifaceHa, role]));
  const sections = useMemo(() => genererScriptsLb(params), [params]);

  const [depot, setDepot] = useState<Record<string, string>>({});
  const partager = async (sec: { id: string; code: string; fichier: string }) => {
    setDepot(d => ({ ...d, [sec.id]: 'en cours' }));
    try {
      const r = await deposerScript(sec.fichier, sec.code);
      setDepot(d => ({ ...d, [sec.id]: lignesRecuperation(r.url, sec.fichier, sec.id !== 'verif') }));
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
        <div style={legende}>⚖️ Le load balancer</div>
        <div style={rangee}>
          <div><label style={etiquette}>Nom de la VM</label><input style={champ} value={vm} onChange={e => persist('lb_vm', e.target.value, setVm)} placeholder="SRV_LB_01" /></div>
          <div><label style={etiquette}>Adresse IP</label><input style={{ ...champ, ...mono }} value={ip} onChange={e => persist('lb_ip', e.target.value, setIp)} placeholder="10.180.30.10" /></div>
          <div><label style={etiquette}>Masque (CIDR)</label><select style={champ} value={cidr} onChange={e => persist('lb_cidr', e.target.value, setCidr)}>{CIDRS.map(c => <option key={c} value={c}>/{c}</option>)}</select></div>
          <div><label style={etiquette}>Passerelle <span className="meta" style={{ fontWeight: 400 }}>(auto .254)</span></label><input style={{ ...champ, ...mono }} value={gwSaisi} onChange={e => persist('lb_gw', e.target.value, setGw)} placeholder={passerelleDe(ip) || '10.180.30.254'} /></div>
          <div><label style={etiquette}>DNS <span className="meta" style={{ fontWeight: 400 }}>(défaut : passerelle)</span></label><input style={{ ...champ, ...mono }} value={dns} onChange={e => persist('lb_dns', e.target.value, setDns)} placeholder={gw || '10.180.10.1'} /></div>
          <div><label style={etiquette}>Carte réseau <span className="meta" style={{ fontWeight: 400 }}>(auto)</span></label><input style={{ ...champ, ...mono }} value={iface} onChange={e => persist('lb_iface', e.target.value, setIface)} placeholder="eth0" /></div>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, cursor: 'pointer' }}><input type="checkbox" checked={mdpSysteme} onChange={e => setMdpSysteme(e.target.checked)} /> root en {MDP} (console)</label>
        </div>
      </div>

      <div style={groupe}>
        <div style={legende}>🎯 La répartition</div>
        <div style={rangee}>
          <div><label style={etiquette}>Algorithme</label><select style={champ} value={algo} onChange={e => persist('lb_algo', e.target.value, v => setAlgo(v as Algo))}>{ALGOS.map(a => <option key={a} value={a}>{libelleAlgo(a)}</option>)}</select></div>
          <div><label style={etiquette}>server_name <span className="meta" style={{ fontWeight: 400 }}>(_ = tout)</span></label><input style={{ ...champ, ...mono }} value={serverName} onChange={e => persist('lb_sn', e.target.value, setServerName)} placeholder="www.bordeaux.local" /></div>
          <div><label style={etiquette}>max_fails <span className="meta" style={{ fontWeight: 400 }}>(échecs)</span></label><input style={{ ...champ, ...mono }} value={maxFails} onChange={e => persist('lb_mf', e.target.value, setMaxFails)} placeholder="3" /></div>
          <div><label style={etiquette}>fail_timeout <span className="meta" style={{ fontWeight: 400 }}>(secondes)</span></label><input style={{ ...champ, ...mono }} value={failTimeout} onChange={e => persist('lb_ft', e.target.value, setFailTimeout)} placeholder="10" /></div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={etiquette}>Backends <span className="meta" style={{ fontWeight: 400 }}>— une ligne « ip[:port] [weight=N] [backup] » (défaut port 80 ; <code>backup</code> = serveur de secours)</span></label>
          <textarea style={zone} value={backends} onChange={e => persist('lb_be', e.target.value, setBackends)} spellCheck={false} />
          {be.length > 0 && (
            <div className="meta" style={{ fontSize: 11.5, marginTop: 6 }}>
              {be.length} backend{be.length > 1 ? 's' : ''} : {be.map((b, i) => <code key={b.host + b.port + i} style={{ marginRight: 6 }}>{b.host}:{b.port}{b.backup ? ' (secours)' : b.weight ? ` ×${b.weight}` : ''}</code>)}
            </div>
          )}
          {algo === 'ip_hash' && (
            <div className="meta" style={{ fontSize: 11.5, marginTop: 6 }}>
              <code>ip_hash</code> colle chaque client à son backend (persistance de session). Le sticky par cookie et les <em>health checks actifs</em> demandent nginx Plus ; ici, checks passifs (<code>max_fails</code>).
            </div>
          )}
        </div>
      </div>

      <div style={groupe}>
        <div style={legende}>🔧 Options</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, cursor: 'pointer' }}><input type="checkbox" checked={tls} onChange={e => { setTls(e.target.checked); lsSetB('lb_tls', e.target.checked); }} /> Terminaison HTTPS <span className="meta">(cert auto-signé, labo)</span></label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, cursor: 'pointer' }}><input type="checkbox" checked={status} onChange={e => { setStatus(e.target.checked); lsSetB('lb_status', e.target.checked); }} /> Page <code>stub_status</code> (:8080)</label>
        </div>
        {status && (
          <div style={{ marginTop: 10, maxWidth: 320 }}>
            <label style={etiquette}>Réseau admin autorisé pour <code>/nginx_status</code></label>
            <input style={{ ...champ, ...mono }} value={statusAllow} onChange={e => persist('lb_sa', e.target.value, setStatusAllow)} placeholder="10.180.0.0/16" />
          </div>
        )}
      </div>

      <div style={groupe}>
        <div style={legende}>🛡️ Haute disponibilité <span className="meta" style={{ fontWeight: 400 }}>(optionnel — laisser la VIP vide pour un seul LB)</span></div>
        <div style={rangee}>
          <div><label style={etiquette}>IP virtuelle (VIP)</label><input style={{ ...champ, ...mono }} value={vip} onChange={e => persist('lb_vip', e.target.value, setVip)} placeholder="10.180.30.9" /></div>
          <div><label style={etiquette}>Rôle de ce nœud</label><select style={champ} value={role} onChange={e => persist('lb_role', e.target.value, v => setRole(v as 'MASTER' | 'BACKUP'))}><option value="MASTER">MASTER (priorité 110)</option><option value="BACKUP">BACKUP (priorité 100)</option></select></div>
          <div><label style={etiquette}>Interface VRRP <span className="meta" style={{ fontWeight: 400 }}>(auto)</span></label><input style={{ ...champ, ...mono }} value={ifaceHa} onChange={e => persist('lb_ifha', e.target.value, setIfaceHa)} placeholder="eth0" /></div>
        </div>
        <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>
          {ipValide(vip)
            ? <>keepalived fait vivre la VIP <code>{vip}</code> sur le MASTER et la bascule sur le BACKUP si nginx tombe. Faire pointer le DNS des clients sur la <strong>VIP</strong>, jouer le script keepalived sur <strong>les deux</strong> LB (l’un MASTER, l’autre BACKUP).</>
            : <>Sans VIP, un seul répartiteur — c’est lui le point unique de défaillance. Renseigner une VIP génère le script keepalived.</>}
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
                <button type="button" onClick={() => telecharger(sec.code, sec.fichier)} style={{ ...bouton, borderColor: 'var(--border)', color: 'var(--text)' }} title={`Télécharger ${sec.fichier}`}>💾 .sh</button>
              )}
              {sec.id !== 'verif' && (
                <button type="button" onClick={() => copier('console-' + sec.id, pourConsoleLb(sec))} style={{ ...bouton, background: copie === 'console-' + sec.id ? 'var(--accent)' : 'transparent', color: copie === 'console-' + sec.id ? '#fff' : 'var(--accent)' }} title="Version qui s’enregistre dans ~/ et se lance : à coller telle quelle dans le terminal">
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
                  <div className="meta" style={{ fontSize: 11.5, marginBottom: 4 }}>À taper dans la VM (valable 7 jours, le script est récupéré tel quel, aucun collage) :</div>
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
        Le script pose l’adresse fixe, installe nginx, écrit <code>/etc/nginx/conf.d/loadbalancer.conf</code>
        (<code>upstream</code> + serveur proxy, health checks passifs <code>max_fails</code>/<code>fail_timeout</code>,
        serveur de secours, <code>stub_status</code>), valide avec <code>nginx -t</code> et recharge. Ouvre le port
        <code> 80</code> (et <code>443</code> si HTTPS) sur le LB, et le flux du LB vers chaque backend. La théorie et le pas à pas :
        <a href="/pages/procedure-loadbalancer-debian"> mettre en place un load balancer</a>.
      </div>
    </div>
  );
}

/**
 * Configurateur « serveur DNS BIND9 » — îlot React (data-block="bind9-configurator").
 *
 * À partir d'un domaine, d'une IP de serveur, d'un réseau et d'une liste
 * d'enregistrements, produit le script d'installation d'un serveur DNS maître
 * (named.conf.options + named.conf.local + zone directe + zone inverse, avec
 * named-checkconf / named-checkzone et tests dig), un script pour un serveur
 * secondaire (esclave) quand une IP est donnée, et un bloc de vérification.
 *
 * Fait suite aux configurateurs duo web + base et bastion : mêmes briques de
 * script (identité du clone, adresse fixe, séquence réseau) et mêmes boutons.
 */
import { memo, useDeferredValue, useMemo, useRef, useState } from 'react';
import { deposerScript, lignesRecuperation } from '@/lib/partage-script';
import { MDP, reseauCidr } from '@/lib/web-db-scripts';
import {
  genererScriptsBind, listeEnregistrements, enregistrementsEffectifs, zoneInverse,
  ipValide, pourConsoleBind, type ParamsBind,
} from '@/lib/bind9-scripts';

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

const lsGet = (k: string, d: string) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* indisponible */ } };
const reseauDe = (ip: string, cidr: number) => { const n = ip.split('.').map(Number).reduce((a, b) => (a << 8) + b, 0) >>> 0; const m = cidr === 0 ? 0 : (0xffffffff << (32 - cidr)) >>> 0; return (n & m) >>> 0; };
const passerelleDe = (ip: string) => { const m = ip.match(/^(\d+\.\d+\.\d+)\.\d+$/); return m ? `${m[1]}.254` : ''; };
const domaineValide = (s: string) => /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(s);

const Bloc = memo(function Bloc({ code, refPre }: { code: string; refPre: (el: HTMLPreElement | null) => void }) {
  return <pre ref={refPre} style={pre} tabIndex={0}><code>{code}</code></pre>;
});

/*
 * @id     tssr.atelier.bind9Configurator
 * @do     configurer_dns_bind9
 * @role   ui
 * @layer  ui
 * @human  Atelier : serveur DNS BIND9 (maître + secondaire), zones directe et inverse.
 */
export function Bind9Configurator() {
  const [vm, setVm] = useState(() => lsGet('dns_vm', 'SRV_DNS_01'));
  const [ip, setIp] = useState(() => lsGet('dns_ip', '192.168.10.1'));
  const [cidr, setCidr] = useState(() => lsGet('dns_cidr', '24'));
  const [gwSaisi, setGw] = useState(() => lsGet('dns_gw', ''));
  const [iface, setIface] = useState(() => lsGet('dns_iface', ''));
  const [mdpSysteme, setMdpSysteme] = useState(true);
  const [domaine, setDomaine] = useState(() => lsGet('dns_domaine', 'miyukini.lan'));
  const [forwarders, setForwarders] = useState(() => lsGet('dns_fwd', '1.1.1.1 8.8.8.8'));
  const [mx, setMx] = useState(() => lsGet('dns_mx', ''));
  const [enregistrements, setEnr] = useState(() => lsGet('dns_enr', 'srv 192.168.10.1\nwww 192.168.10.20\nintranet 192.168.10.20\nfichiers 192.168.10.30'));
  const [secondaire, setSec] = useState(() => lsGet('dns_sec', ''));
  const [vmSec, setVmSec] = useState(() => lsGet('dns_vmsec', 'SRV_DNS_02'));
  const [copie, setCopie] = useState('');
  const pres = useRef<Record<string, HTMLPreElement | null>>({});

  const persist = (k: string, v: string, set: (v: string) => void) => { set(v); lsSet(k, v); };
  const gw = gwSaisi || passerelleDe(ip);
  const inv = useMemo(() => (ipValide(ip) ? zoneInverse(ip, cidr) : null), [ip, cidr]);
  const enr = useMemo(() => listeEnregistrements(enregistrements), [enregistrements]);

  const soucis = useMemo(() => {
    const s: string[] = [];
    if (!ipValide(ip)) s.push(`« ${ip} » n'est pas une adresse IPv4.`);
    else if (gw && !ipValide(gw)) s.push(`La passerelle « ${gw} » n'est pas une adresse IPv4.`);
    else if (gw && reseauDe(ip, Number(cidr)) !== reseauDe(gw, Number(cidr))) s.push(`La passerelle ${gw} est hors du sous-réseau ${ip}/${cidr}.`);
    if (!domaineValide(domaine)) s.push(`« ${domaine} » n'est pas un nom de domaine valide (ex. miyukini.lan).`);
    if (!enr.length) s.push('Aucun enregistrement A valide (une ligne « nom ip », le nom en minuscules).');
    if (secondaire.trim() && !ipValide(secondaire)) s.push(`L'adresse du secondaire « ${secondaire} » n'est pas une IPv4.`);
    if (ipValide(secondaire) && secondaire === ip) s.push('Le secondaire a la même adresse que le maître.');
    if (mx.trim() && !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(mx.trim())) s.push('Le nom d’hôte du serveur mail (MX) doit être un label court (ex. « mail »).');
    return s;
  }, [ip, gw, cidr, domaine, enr, secondaire, mx]);

  const params = useDeferredValue(useMemo<ParamsBind>(() => ({
    vm, ip, cidr, gw, iface, mdpSysteme, domaine: domaine.trim().toLowerCase(),
    forwarders, enregistrements, mx: mx.trim().toLowerCase(), secondaire: secondaire.trim(), vmSec,
  }), [vm, ip, cidr, gw, iface, mdpSysteme, domaine, forwarders, enregistrements, mx, secondaire, vmSec]));
  const sections = useMemo(() => genererScriptsBind(params), [params]);
  const apercuA = useMemo(() => (domaineValide(params.domaine) ? enregistrementsEffectifs(params) : []), [params]);
  const mxSansA = mx.trim() !== '' && !enr.some(r => r.nom === mx.trim().toLowerCase());

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
        <div style={legende}>🌿 Le serveur DNS maître</div>
        <div style={rangee}>
          <div><label style={etiquette}>Nom de la VM</label><input style={champ} value={vm} onChange={e => persist('dns_vm', e.target.value, setVm)} placeholder="SRV_DNS_01" /></div>
          <div><label style={etiquette}>Adresse IP</label><input style={{ ...champ, ...mono }} value={ip} onChange={e => persist('dns_ip', e.target.value, setIp)} placeholder="192.168.10.1" /></div>
          <div><label style={etiquette}>Masque (CIDR)</label><select style={champ} value={cidr} onChange={e => persist('dns_cidr', e.target.value, setCidr)}>{CIDRS.map(c => <option key={c} value={c}>/{c}</option>)}</select></div>
          <div><label style={etiquette}>Passerelle <span className="meta" style={{ fontWeight: 400 }}>(auto .254)</span></label><input style={{ ...champ, ...mono }} value={gwSaisi} onChange={e => persist('dns_gw', e.target.value, setGw)} placeholder={passerelleDe(ip) || '192.168.10.254'} /></div>
          <div><label style={etiquette}>Carte réseau <span className="meta" style={{ fontWeight: 400 }}>(auto)</span></label><input style={{ ...champ, ...mono }} value={iface} onChange={e => persist('dns_iface', e.target.value, setIface)} placeholder="eth0" /></div>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, cursor: 'pointer' }}><input type="checkbox" checked={mdpSysteme} onChange={e => setMdpSysteme(e.target.checked)} /> root en {MDP} (console)</label>
          {inv && <span className="meta" style={{ fontSize: 12.5 }}>Zone inverse : <code>{inv.zone}</code></span>}
        </div>
      </div>

      <div style={groupe}>
        <div style={legende}>🌍 La zone</div>
        <div style={rangee}>
          <div><label style={etiquette}>Domaine</label><input style={{ ...champ, ...mono }} value={domaine} onChange={e => persist('dns_domaine', e.target.value, setDomaine)} placeholder="miyukini.lan" /></div>
          <div><label style={etiquette}>Redirecteurs <span className="meta" style={{ fontWeight: 400 }}>(forwarders)</span></label><input style={{ ...champ, ...mono }} value={forwarders} onChange={e => persist('dns_fwd', e.target.value, setForwarders)} placeholder="1.1.1.1 8.8.8.8" /></div>
          <div><label style={etiquette}>Hôte mail (MX) <span className="meta" style={{ fontWeight: 400 }}>(optionnel)</span></label><input style={{ ...champ, ...mono }} value={mx} onChange={e => persist('dns_mx', e.target.value, setMx)} placeholder="mail" /></div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={etiquette}>Enregistrements A <span className="meta" style={{ fontWeight: 400 }}>— une ligne « nom ip » (l’hôte <code>ns</code> = ce serveur est ajouté d’office ; les PTR de la zone inverse en découlent)</span></label>
          <textarea style={zone} value={enregistrements} onChange={e => persist('dns_enr', e.target.value, setEnr)} spellCheck={false} />
          {apercuA.length > 0 && (
            <div className="meta" style={{ fontSize: 11.5, marginTop: 6 }}>
              {apercuA.length} enregistrement{apercuA.length > 1 ? 's' : ''} : {apercuA.map(r => <code key={r.nom + r.ip} style={{ marginRight: 6 }}>{r.nom}.{params.domaine} → {r.ip}</code>)}
            </div>
          )}
          {mxSansA && (
            <div className="meta" style={{ fontSize: 11.5, marginTop: 6, color: '#b45309' }}>
              ⚠️ Le MX pointe sur <code>{mx.trim().toLowerCase()}.{params.domaine}</code> mais aucun enregistrement A ne porte ce nom — ajoute une ligne <code>{mx.trim().toLowerCase()} &lt;ip du serveur mail&gt;</code>, sinon le MX est « dangling ».
            </div>
          )}
        </div>
      </div>

      <div style={groupe}>
        <div style={legende}>🔁 Serveur secondaire <span className="meta" style={{ fontWeight: 400 }}>(optionnel — laisser vide pour un seul serveur)</span></div>
        <div style={rangee}>
          <div><label style={etiquette}>Nom de la VM secondaire</label><input style={champ} value={vmSec} onChange={e => persist('dns_vmsec', e.target.value, setVmSec)} placeholder="SRV_DNS_02" /></div>
          <div><label style={etiquette}>Adresse IP du secondaire</label><input style={{ ...champ, ...mono }} value={secondaire} onChange={e => persist('dns_sec', e.target.value, setSec)} placeholder="192.168.10.2" /></div>
        </div>
        <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>
          {ipValide(secondaire)
            ? <>Le maître autorise le transfert de zone vers <code>{secondaire}</code> (<code>allow-transfer</code> + <code>also-notify</code>) et l’esclave copie les zones à chaque changement — un <code>ns2</code> est ajouté automatiquement.</>
            : <>Sans secondaire, un seul serveur fait autorité. Un DNS de production a toujours au moins deux serveurs.</>}
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
                <button type="button" onClick={() => copier('console-' + sec.id, pourConsoleBind(sec))} style={{ ...bouton, background: copie === 'console-' + sec.id ? 'var(--accent)' : 'transparent', color: copie === 'console-' + sec.id ? '#fff' : 'var(--accent)' }} title="Version qui s’enregistre dans ~/ et se lance : à coller telle quelle dans le terminal">
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
        Les scripts posent l’adresse fixe, installent BIND9, écrivent <code>named.conf.options</code>, <code>named.conf.local</code> et les fichiers de zone, valident avec <code>named-checkconf</code> / <code>named-checkzone</code>, démarrent le service et testent avec <code>dig</code>. Pense à ouvrir le port <code>53</code> (UDP <em>et</em> TCP) si un pare-feu est actif, et à pointer le DNS des clients sur <code>{ipValide(ip) ? ip : 'l’IP du serveur'}</code>.
      </div>
    </div>
  );
}

/**
 * Configurateur « VPN — IPsec site-à-site & OpenVPN nomade » pour OPNsense /
 * pfSense — îlot React (data-block="vpn-configurator").
 *
 * Deux modes : IPsec site-à-site (Phase 1 + Phase 2 + règles + le miroir de
 * l'autre bout) et OpenVPN accès nomade (serveur + règles). Produit le plan
 * précis, menu par menu, dans le dialecte OPNsense ou pfSense.
 *
 * Même famille que les configurateurs OPNsense / pfSense : mêmes champs, mêmes
 * boutons.
 */
import { memo, useDeferredValue, useMemo, useRef, useState } from 'react';
import {
  genererVpn, resumeVpn, ipValide, cidrValide, listeCidr, APPLIANCE,
  type ParamsVpn, type Variante, type TypeVpn,
} from '@/lib/vpn-scripts';

const champ: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' };
const mono: React.CSSProperties = { fontFamily: "ui-monospace,'Space Mono',SFMono-Regular,Menlo,Consolas,monospace" };
const etiquette: React.CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 4 };
const groupe: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', background: 'var(--surface-2)', marginBottom: 14 };
const legende: React.CSSProperties = { fontWeight: 700, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const rangee: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 };
const bouton: React.CSSProperties = { padding: '6px 14px', border: '1px solid var(--accent)', borderRadius: 8, background: 'transparent', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' };
const onglet = (actif: boolean): React.CSSProperties => ({ padding: '8px 16px', border: '1px solid var(--border)', borderBottom: actif ? '2px solid var(--accent)' : '1px solid var(--border)', borderRadius: '8px 8px 0 0', background: actif ? 'var(--surface)' : 'var(--surface-2)', color: actif ? 'var(--accent)' : 'var(--text-soft)', fontWeight: 700, cursor: 'pointer', fontSize: 13.5 });
const pre: React.CSSProperties = { ...mono, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', overflowX: 'auto', fontSize: 12.5, lineHeight: 1.55, margin: 0, whiteSpace: 'pre' };
const zone: React.CSSProperties = { ...champ, ...mono, minHeight: 68, resize: 'vertical', fontSize: 12.5 };

const lsGet = (k: string, d: string) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* indisponible */ } };
const P1_CHIFFRES = ['AES256-GCM', 'AES128-GCM', 'AES256-CBC', 'AES128-CBC'];
const HASHES = ['SHA256', 'SHA384', 'SHA512', 'SHA1'];
const DH = ['14', '15', '16', '19', '20', '5'];
const PFS = ['14', '15', '16', '19', 'off'];

const Bloc = memo(function Bloc({ code, refPre }: { code: string; refPre: (el: HTMLPreElement | null) => void }) {
  return <pre ref={refPre} style={pre} tabIndex={0}><code>{code}</code></pre>;
});

/*
 * @id     tssr.atelier.vpnConfigurator
 * @do     configurer_vpn_ipsec_openvpn
 * @role   ui
 * @layer  ui
 * @human  Atelier : VPN IPsec site-à-site et OpenVPN nomade (OPNsense / pfSense).
 */
export function VpnConfigurator() {
  const [variante, setVariante] = useState<Variante>(() => (lsGet('vpn_var', 'pfsense') as Variante));
  const [type, setType] = useState<TypeVpn>(() => (lsGet('vpn_type', 'ipsec') as TypeVpn));
  // IPsec
  const [siteLocal, setSiteLocal] = useState(() => lsGet('vpn_sl', 'Bordeaux'));
  const [siteDistant, setSiteDistant] = useState(() => lsGet('vpn_sd', 'Toulouse'));
  const [wanLocal, setWanLocal] = useState(() => lsGet('vpn_wl', '10.22.10.65'));
  const [wanDistant, setWanDistant] = useState(() => lsGet('vpn_wd', '10.22.10.164'));
  const [psk, setPsk] = useState(() => lsGet('vpn_psk', ''));
  const [ikev, setIkev] = useState<'ikev2' | 'ikev1'>(() => (lsGet('vpn_ike', 'ikev2') as 'ikev2' | 'ikev1'));
  const [p1Chiffre, setP1Chiffre] = useState(() => lsGet('vpn_p1c', 'AES256-GCM'));
  const [p1Hash, setP1Hash] = useState(() => lsGet('vpn_p1h', 'SHA256'));
  const [p1Dh, setP1Dh] = useState(() => lsGet('vpn_p1d', '14'));
  const [p2Chiffre, setP2Chiffre] = useState(() => lsGet('vpn_p2c', 'AES256-GCM'));
  const [p2Hash, setP2Hash] = useState(() => lsGet('vpn_p2h', 'SHA256'));
  const [p2Pfs, setP2Pfs] = useState(() => lsGet('vpn_p2p', '14'));
  const [reseauxLocaux, setResLoc] = useState(() => lsGet('vpn_rl', '10.180.10.0/24\n10.180.30.0/24'));
  const [reseauxDistants, setResDist] = useState(() => lsGet('vpn_rd', '10.160.10.0/24\n10.160.30.0/24'));
  // OpenVPN
  const [ovpnReseau, setOvpnReseau] = useState(() => lsGet('vpn_or', '10.0.8.0/24'));
  const [ovpnLocaux, setOvpnLocaux] = useState(() => lsGet('vpn_ol', '10.180.10.0/24'));
  const [ovpnAuth, setOvpnAuth] = useState<'cert' | 'cert-user'>(() => (lsGet('vpn_oa', 'cert-user') as 'cert' | 'cert-user'));
  const [ovpnProto, setOvpnProto] = useState<'udp' | 'tcp'>(() => (lsGet('vpn_op', 'udp') as 'udp' | 'tcp'));
  const [ovpnPort, setOvpnPort] = useState(() => lsGet('vpn_opt', '1194'));
  const [ovpnDns, setOvpnDns] = useState(() => lsGet('vpn_od', ''));
  const [copie, setCopie] = useState('');
  const pres = useRef<Record<string, HTMLPreElement | null>>({});

  const persist = (k: string, v: string, set: (v: string) => void) => { set(v); lsSet(k, v); };

  const soucis = useMemo(() => {
    const s: string[] = [];
    if (type === 'ipsec') {
      if (!ipValide(wanLocal)) s.push(`Le WAN local « ${wanLocal} » n'est pas une adresse IPv4.`);
      if (!ipValide(wanDistant)) s.push(`Le WAN distant « ${wanDistant} » n'est pas une adresse IPv4.`);
      if (ipValide(wanLocal) && wanLocal.trim() === wanDistant.trim()) s.push('Les deux endpoints WAN sont identiques.');
      if (!psk.trim()) s.push('La clé pré-partagée (PSK) est vide.');
      else if (psk.trim().length < 12) s.push('La clé pré-partagée est courte (≥ 12 caractères conseillés).');
      if (!listeCidr(reseauxLocaux).length) s.push('Aucun réseau local valide (CIDR, ex. 10.180.10.0/24).');
      if (!listeCidr(reseauxDistants).length) s.push('Aucun réseau distant valide (CIDR).');
    } else {
      if (!cidrValide(ovpnReseau)) s.push(`Le réseau du tunnel « ${ovpnReseau} » n'est pas un CIDR valide.`);
      if (!listeCidr(ovpnLocaux).length) s.push('Aucun réseau interne poussé valide (CIDR).');
      if (!/^\d{1,5}$/.test(ovpnPort.trim())) s.push('Le port OpenVPN doit être un nombre.');
    }
    return s;
  }, [type, wanLocal, wanDistant, psk, reseauxLocaux, reseauxDistants, ovpnReseau, ovpnLocaux, ovpnPort]);

  const params = useDeferredValue(useMemo<ParamsVpn>(() => ({
    variante, type,
    siteLocal: siteLocal.trim(), siteDistant: siteDistant.trim(),
    wanLocal: wanLocal.trim(), wanDistant: wanDistant.trim(), psk: psk.trim(), ikev,
    p1Chiffre, p1Hash, p1Dh, p2Chiffre, p2Hash, p2Pfs,
    reseauxLocaux, reseauxDistants,
    ovpnReseau: ovpnReseau.trim(), ovpnLocaux, ovpnAuth, ovpnProto, ovpnPort: ovpnPort.trim(), ovpnDns: ovpnDns.trim(),
  }), [variante, type, siteLocal, siteDistant, wanLocal, wanDistant, psk, ikev, p1Chiffre, p1Hash, p1Dh, p2Chiffre, p2Hash, p2Pfs, reseauxLocaux, reseauxDistants, ovpnReseau, ovpnLocaux, ovpnAuth, ovpnProto, ovpnPort, ovpnDns]));
  const sections = useMemo(() => genererVpn(params), [params]);

  const copier = async (cle: string, texte: string) => {
    const fini = () => { setCopie(cle); setTimeout(() => setCopie(''), 1600); };
    try { await navigator.clipboard.writeText(texte); fini(); return; } catch { /* repli */ }
    const ta = document.createElement('textarea');
    ta.value = texte; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    if (ok) { fini(); return; }
    const p = pres.current[cle];
    if (p) { const r = document.createRange(); r.selectNodeContents(p); const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(r); }
    setCopie('sel-' + cle); setTimeout(() => setCopie(''), 2500);
  };
  const toutCopier = () => copier('tout', `# ${resumeVpn(params)}\n\n` + sections.map(s => `### ${s.titre}\n${s.code}`).join('\n\n'));
  const majV = (v: Variante) => { setVariante(v); lsSet('vpn_var', v); };
  const majT = (t: TypeVpn) => { setType(t); lsSet('vpn_type', t); };

  return (
    <div style={{ margin: '14px 0' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        <button type="button" style={onglet(type === 'ipsec')} onClick={() => majT('ipsec')}>🔐 IPsec site-à-site</button>
        <button type="button" style={onglet(type === 'openvpn')} onClick={() => majT('openvpn')}>🧑‍💻 OpenVPN nomade</button>
        <div style={{ flex: 1 }} />
        <select style={{ ...champ, width: 'auto' }} value={variante} onChange={e => majV(e.target.value as Variante)}>
          <option value="pfsense">pfSense</option>
          <option value="opnsense">OPNsense</option>
        </select>
      </div>

      {type === 'ipsec' ? (
        <>
          <div style={groupe}>
            <div style={legende}>🌍 Les deux sites</div>
            <div style={rangee}>
              <div><label style={etiquette}>Site local</label><input style={champ} value={siteLocal} onChange={e => persist('vpn_sl', e.target.value, setSiteLocal)} placeholder="Bordeaux" /></div>
              <div><label style={etiquette}>WAN local <span className="meta" style={{ fontWeight: 400 }}>(mon endpoint)</span></label><input style={{ ...champ, ...mono }} value={wanLocal} onChange={e => persist('vpn_wl', e.target.value, setWanLocal)} placeholder="10.22.10.65" /></div>
              <div><label style={etiquette}>Site distant</label><input style={champ} value={siteDistant} onChange={e => persist('vpn_sd', e.target.value, setSiteDistant)} placeholder="Toulouse" /></div>
              <div><label style={etiquette}>WAN distant <span className="meta" style={{ fontWeight: 400 }}>(remote gateway)</span></label><input style={{ ...champ, ...mono }} value={wanDistant} onChange={e => persist('vpn_wd', e.target.value, setWanDistant)} placeholder="10.22.10.164" /></div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={etiquette}>Clé pré-partagée (PSK) <span className="meta" style={{ fontWeight: 400 }}>— identique des deux côtés</span></label>
              <input style={{ ...champ, ...mono }} value={psk} onChange={e => persist('vpn_psk', e.target.value, setPsk)} placeholder="une phrase longue et aléatoire" />
            </div>
          </div>

          <div style={groupe}>
            <div style={legende}>🔑 Phase 1 (IKE)</div>
            <div style={rangee}>
              <div><label style={etiquette}>Version IKE</label><select style={champ} value={ikev} onChange={e => persist('vpn_ike', e.target.value, v => setIkev(v as 'ikev2' | 'ikev1'))}><option value="ikev2">IKEv2</option><option value="ikev1">IKEv1</option></select></div>
              <div><label style={etiquette}>Chiffrement</label><select style={champ} value={p1Chiffre} onChange={e => persist('vpn_p1c', e.target.value, setP1Chiffre)}>{P1_CHIFFRES.map(x => <option key={x} value={x}>{x}</option>)}</select></div>
              <div><label style={etiquette}>Hash / PRF</label><select style={champ} value={p1Hash} onChange={e => persist('vpn_p1h', e.target.value, setP1Hash)}>{HASHES.map(x => <option key={x} value={x}>{x}</option>)}</select></div>
              <div><label style={etiquette}>Groupe DH</label><select style={champ} value={p1Dh} onChange={e => persist('vpn_p1d', e.target.value, setP1Dh)}>{DH.map(x => <option key={x} value={x}>{x}</option>)}</select></div>
            </div>
          </div>

          <div style={groupe}>
            <div style={legende}>📦 Phase 2 (ESP) & réseaux</div>
            <div style={rangee}>
              <div><label style={etiquette}>Chiffrement</label><select style={champ} value={p2Chiffre} onChange={e => persist('vpn_p2c', e.target.value, setP2Chiffre)}>{P1_CHIFFRES.map(x => <option key={x} value={x}>{x}</option>)}</select></div>
              <div><label style={etiquette}>Hash</label><select style={champ} value={p2Hash} onChange={e => persist('vpn_p2h', e.target.value, setP2Hash)}>{HASHES.map(x => <option key={x} value={x}>{x}</option>)}</select></div>
              <div><label style={etiquette}>PFS</label><select style={champ} value={p2Pfs} onChange={e => persist('vpn_p2p', e.target.value, setP2Pfs)}>{PFS.map(x => <option key={x} value={x}>{x}</option>)}</select></div>
            </div>
            <div style={{ ...rangee, marginTop: 12 }}>
              <div><label style={etiquette}>Réseaux locaux <span className="meta" style={{ fontWeight: 400 }}>(un CIDR / ligne)</span></label><textarea style={zone} value={reseauxLocaux} onChange={e => persist('vpn_rl', e.target.value, setResLoc)} spellCheck={false} /></div>
              <div><label style={etiquette}>Réseaux distants <span className="meta" style={{ fontWeight: 400 }}>(un CIDR / ligne)</span></label><textarea style={zone} value={reseauxDistants} onChange={e => persist('vpn_rd', e.target.value, setResDist)} spellCheck={false} /></div>
            </div>
            <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>
              {listeCidr(reseauxLocaux).length * listeCidr(reseauxDistants).length} entrée(s) Phase 2 générée(s) (un couple local ↔ distant chacune).
            </div>
          </div>
        </>
      ) : (
        <>
          <div style={groupe}>
            <div style={legende}>🧑‍💻 Serveur OpenVPN (accès nomade)</div>
            <div style={rangee}>
              <div><label style={etiquette}>Réseau du tunnel</label><input style={{ ...champ, ...mono }} value={ovpnReseau} onChange={e => persist('vpn_or', e.target.value, setOvpnReseau)} placeholder="10.0.8.0/24" /></div>
              <div><label style={etiquette}>Protocole</label><select style={champ} value={ovpnProto} onChange={e => persist('vpn_op', e.target.value, v => setOvpnProto(v as 'udp' | 'tcp'))}><option value="udp">UDP</option><option value="tcp">TCP</option></select></div>
              <div><label style={etiquette}>Port</label><input style={{ ...champ, ...mono }} value={ovpnPort} onChange={e => persist('vpn_opt', e.target.value, setOvpnPort)} placeholder="1194" /></div>
              <div><label style={etiquette}>Authentification</label><select style={champ} value={ovpnAuth} onChange={e => persist('vpn_oa', e.target.value, v => setOvpnAuth(v as 'cert' | 'cert-user'))}><option value="cert-user">Certificat + compte</option><option value="cert">Certificat seul</option></select></div>
            </div>
            <div style={{ ...rangee, marginTop: 12 }}>
              <div><label style={etiquette}>Réseaux internes poussés <span className="meta" style={{ fontWeight: 400 }}>(un CIDR / ligne)</span></label><textarea style={zone} value={ovpnLocaux} onChange={e => persist('vpn_ol', e.target.value, setOvpnLocaux)} spellCheck={false} /></div>
              <div><label style={etiquette}>DNS poussé <span className="meta" style={{ fontWeight: 400 }}>(optionnel)</span></label><input style={{ ...champ, ...mono }} value={ovpnDns} onChange={e => persist('vpn_od', e.target.value, setOvpnDns)} placeholder="10.180.10.1" /></div>
            </div>
          </div>
        </>
      )}

      {soucis.length > 0 && (
        <aside className="pb-note pb-note-red" style={{ marginBottom: 14 }}>
          <p className="pb-note-title">🚫 À corriger avant de copier</p>
          <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>{soucis.map(s => <li key={s}>{s}</li>)}</ul>
        </aside>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <div className="meta" style={{ fontSize: 12 }}>{resumeVpn(params)} — {APPLIANCE[variante]}, par l’interface web.</div>
        <button type="button" onClick={toutCopier} style={{ ...bouton, background: copie === 'tout' ? 'var(--accent)' : 'transparent', color: copie === 'tout' ? '#fff' : 'var(--accent)' }}>{copie === 'tout' ? '✓ Copié' : 'Tout copier'}</button>
      </div>

      {sections.map(sec => (
        <div key={sec.id} style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 6px', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>📜 {sec.titre}</div>
            <button type="button" onClick={() => copier(sec.id, sec.code)} style={{ ...bouton, background: copie === sec.id ? 'var(--accent)' : 'transparent', color: copie === sec.id ? '#fff' : 'var(--accent)' }}>
              {copie === sec.id ? '✓ Copié' : copie === 'sel-' + sec.id ? 'Sélectionné — Ctrl+C' : 'Copier'}
            </button>
          </div>
          <Bloc code={sec.code} refPre={el => { pres.current[sec.id] = el; }} />
        </div>
      ))}

      <div className="meta" style={{ fontSize: 11.5, marginTop: 10 }}>
        {type === 'ipsec'
          ? <>Le tunnel monte quand la Phase 1 est <strong>identique au bit près</strong> des deux côtés (même IKE, chiffrement, hash, DH, même PSK) et que les <strong>règles</strong> laissent passer ISAKMP (UDP 500/4500) et ESP. Le pas à pas complet : <a href="/pages/procedure-vpn-ipsec-pfsense">VPN IPsec site-à-site (pfSense)</a>.</>
          : <>Les certificats se créent <strong>avant</strong> le serveur (CA → cert serveur → cert client). Le pas à pas : <a href="/pages/openvpn-pfsense">OpenVPN sur pfSense</a> · <a href="/pages/opnsense-vpn-ids">OPNsense : accès distants</a>.</>}
      </div>
    </div>
  );
}

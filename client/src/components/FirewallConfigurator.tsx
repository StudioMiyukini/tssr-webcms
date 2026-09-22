/**
 * Configurateur partagé OPNsense / pfSense — le plan de configuration de
 * l'interface web (interfaces, DHCP, alias, NAT, règles), dialecte-aware, plus
 * le config.xml par zone pour pfSense (restaurable via « Restore area »).
 *
 * Deux blocs l'utilisent : OpnsenseConfigurator et PfsenseConfigurator, qui ne
 * font que fixer la variante.
 */
import { memo, useDeferredValue, useMemo, useRef, useState } from 'react';
import {
  genererFirewall, genererXml, zoneRestore, APPLIANCE, RESTORE_MENU,
  ipValide, type Variante, type Iface, type ClefIface, type ParamsFw,
} from '@/lib/firewall-scripts';

const champ: React.CSSProperties = { width: '100%', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 13.5, boxSizing: 'border-box' };
const mono: React.CSSProperties = { fontFamily: "ui-monospace,'Space Mono',SFMono-Regular,Menlo,Consolas,monospace" };
const etiquette: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 4 };
const groupe: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', background: 'var(--surface-2)', marginBottom: 14 };
const legende: React.CSSProperties = { fontWeight: 700, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const bouton: React.CSSProperties = { padding: '6px 14px', border: '1px solid var(--accent)', borderRadius: 8, background: 'transparent', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' };
const petit: React.CSSProperties = { ...bouton, padding: '3px 9px', fontSize: 12, borderColor: 'var(--border)', color: 'var(--text-soft)' };
const pre: React.CSSProperties = { ...mono, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', overflowX: 'auto', fontSize: 12.5, lineHeight: 1.55, margin: 0, whiteSpace: 'pre' };
const zone: React.CSSProperties = { ...champ, ...mono, minHeight: 76, resize: 'vertical', fontSize: 12.5, lineHeight: 1.5 };
const CIDRS = ['8', '16', '22', '23', '24', '25', '26', '27', '28', '29', '30'];
const CLEFS: ClefIface[] = ['wan', 'lan', 'opt1', 'opt2', 'opt3'];

const lsGet = (k: string, d: string) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* */ } };
const jget = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };

const defautIfaces = (v: Variante): Iface[] => {
  const p = v === 'pfsense' ? ['hn0', 'hn1', 'hn2'] : ['hn0', 'hn1', 'hn2'];
  return [
    { clef: 'wan', ifPhys: p[0], descr: 'WAN', mode: 'dhcp', ip: '', cidr: '24', gw: '', dhcpFrom: '', dhcpTo: '' },
    { clef: 'lan', ifPhys: p[1], descr: 'LAN', mode: 'static', ip: '192.168.10.254', cidr: '24', gw: '', dhcpFrom: '192.168.10.100', dhcpTo: '192.168.10.200' },
    { clef: 'opt1', ifPhys: p[2], descr: 'LAN_SRV', mode: 'static', ip: '192.168.20.254', cidr: '24', gw: '', dhcpFrom: '', dhcpTo: '' },
  ];
};
const D_ALIAS = 'reseaux_internes network 192.168.10.0/24 192.168.20.0/24';
const D_NAT = 'wan tcp 80 192.168.20.100 80 Web interne depuis le WAN';
const D_REGLES = 'lan pass tcp any 192.168.20.100 80 LAN vers serveur web\nopt1 block any any reseaux_internes Bloquer OPT1 vers les LAN';
const D_ROUTES = '';

const Bloc = memo(function Bloc({ code, refPre }: { code: string; refPre: (el: HTMLPreElement | null) => void }) {
  return <pre ref={refPre} style={pre} tabIndex={0}><code>{code}</code></pre>;
});

export function FirewallConfigurator({ variante }: { variante: Variante }) {
  const pfx = variante; // préfixe localStorage propre à chaque dialecte
  const [hostname, setHostname] = useState(() => lsGet(`${pfx}_host`, variante === 'pfsense' ? 'pfsense' : 'opnsense'));
  const [domaine, setDomaine] = useState(() => lsGet(`${pfx}_dom`, 'miyukini.lan'));
  const [interfaces, setIfaces] = useState<Iface[]>(() => jget(`${pfx}_ifaces`, defautIfaces(variante)));
  const [aliases, setAliases] = useState(() => lsGet(`${pfx}_alias`, D_ALIAS));
  const [nat, setNat] = useState(() => lsGet(`${pfx}_nat`, D_NAT));
  const [regles, setRegles] = useState(() => lsGet(`${pfx}_regles`, D_REGLES));
  const [dns, setDns] = useState(() => lsGet(`${pfx}_dns`, '192.168.10.254 1.1.1.1'));
  const [fuseau, setFuseau] = useState(() => lsGet(`${pfx}_fuseau`, 'Europe/Paris'));
  const [routes, setRoutes] = useState(() => lsGet(`${pfx}_routes`, D_ROUTES));
  const [vpn, setVpn] = useState(() => lsGet(`${pfx}_vpn`, '') === '1');
  const [vpnReseau, setVpnReseau] = useState(() => lsGet(`${pfx}_vpnres`, '10.0.8.0/24'));
  const [vpnLocaux, setVpnLocaux] = useState(() => lsGet(`${pfx}_vpnloc`, '192.168.10.0/24'));
  const [vpnAuth, setVpnAuth] = useState<'cert' | 'cert-user'>(() => (lsGet(`${pfx}_vpnauth`, 'cert-user') as 'cert' | 'cert-user'));
  const [copie, setCopie] = useState('');
  const pres = useRef<Record<string, HTMLPreElement | null>>({});

  const setIf = (i: number, patch: Partial<Iface>) => setIfaces(a => { const n = a.map((x, k) => k === i ? { ...x, ...patch } : x); lsSet(`${pfx}_ifaces`, JSON.stringify(n)); return n; });
  const addIf = () => setIfaces(a => { const libres = CLEFS.filter(c => !a.some(x => x.clef === c)); const n = [...a, { clef: libres[0] || 'opt3', ifPhys: '', descr: '', mode: 'static', ip: '', cidr: '24', gw: '', dhcpFrom: '', dhcpTo: '' } as Iface]; lsSet(`${pfx}_ifaces`, JSON.stringify(n)); return n; });
  const delIf = (i: number) => setIfaces(a => { const n = a.filter((_, k) => k !== i); lsSet(`${pfx}_ifaces`, JSON.stringify(n)); return n; });
  const persist = (k: string, v: string, set: (v: string) => void) => { set(v); lsSet(k, v); };

  const soucis = useMemo(() => {
    const s: string[] = [];
    if (!interfaces.some(i => i.clef === 'wan')) s.push('Il faut une interface WAN.');
    if (!interfaces.some(i => i.clef === 'lan')) s.push('Il faut une interface LAN.');
    for (const it of interfaces) {
      if (it.mode === 'static' && !ipValide(it.ip)) s.push(`L’adresse de ${it.clef.toUpperCase()} (« ${it.ip} ») n’est pas valide.`);
      if (it.clef === 'wan' && it.mode === 'static' && it.gw && !ipValide(it.gw)) s.push(`La passerelle WAN « ${it.gw} » n’est pas valide.`);
      if ((it.dhcpFrom || it.dhcpTo) && !(ipValide(it.dhcpFrom) && ipValide(it.dhcpTo))) s.push(`La plage DHCP de ${it.clef.toUpperCase()} est incomplète.`);
    }
    return s.slice(0, 6);
  }, [interfaces]);

  const params = useDeferredValue(useMemo<ParamsFw>(() => ({ variante, hostname, domaine, dns, fuseau, interfaces, aliases, nat, regles, routes, vpn, vpnReseau, vpnLocaux, vpnAuth }),
    [variante, hostname, domaine, dns, fuseau, interfaces, aliases, nat, regles, routes, vpn, vpnReseau, vpnLocaux, vpnAuth]));
  const plan = useMemo(() => genererFirewall(params), [params]);
  const xmls = useMemo(() => (variante === 'pfsense' ? genererXml(params) : []), [params, variante]);

  const copier = async (cle: string, texte: string) => {
    const fini = () => { setCopie(cle); setTimeout(() => setCopie(''), 1600); };
    try { await navigator.clipboard.writeText(texte); fini(); return; } catch { /* repli */ }
    const ta = document.createElement('textarea'); ta.value = texte; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; } ta.remove();
    if (ok) { fini(); return; }
    const p = pres.current[cle]; if (p) { const r = document.createRange(); r.selectNodeContents(p); const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(r); }
    setCopie('sel-' + cle); setTimeout(() => setCopie(''), 2500);
  };
  const telecharger = (texte: string, nom: string) => {
    const blob = new Blob([texte], { type: 'application/xml' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = nom; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  return (
    <div style={{ margin: '14px 0' }}>
      <div style={groupe}>
        <div style={legende}>🧱 {APPLIANCE[variante]} — général</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
          <div><label style={etiquette}>Hostname</label><input style={champ} value={hostname} onChange={e => persist(`${pfx}_host`, e.target.value, setHostname)} placeholder={variante} /></div>
          <div><label style={etiquette}>Domaine</label><input style={{ ...champ, ...mono }} value={domaine} onChange={e => persist(`${pfx}_dom`, e.target.value, setDomaine)} placeholder="miyukini.lan" /></div>
          <div><label style={etiquette}>Serveurs DNS</label><input style={{ ...champ, ...mono }} value={dns} onChange={e => persist(`${pfx}_dns`, e.target.value, setDns)} placeholder="192.168.10.254 1.1.1.1" /></div>
          <div><label style={etiquette}>Fuseau horaire</label><input style={{ ...champ, ...mono }} value={fuseau} onChange={e => persist(`${pfx}_fuseau`, e.target.value, setFuseau)} placeholder="Europe/Paris" /></div>
        </div>
      </div>

      <div style={groupe}>
        <div style={legende}>🔌 Interfaces <span className="meta" style={{ fontWeight: 400 }}>(WAN, LAN, puis les zones OPT)</span></div>
        {interfaces.map((it, i) => (
          <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, marginBottom: 8, background: 'var(--surface)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr auto', gap: 8, alignItems: 'end', marginBottom: 8 }}>
              <div><label style={etiquette}>Zone</label><select style={champ} value={it.clef} onChange={e => setIf(i, { clef: e.target.value as ClefIface })}>{CLEFS.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}</select></div>
              <div><label style={etiquette}>Carte physique</label><input style={{ ...champ, ...mono }} value={it.ifPhys} onChange={e => setIf(i, { ifPhys: e.target.value })} placeholder="hn0" /></div>
              <div><label style={etiquette}>Description</label><input style={champ} value={it.descr} onChange={e => setIf(i, { descr: e.target.value })} placeholder="LAN_SRV" /></div>
              <button style={petit} onClick={() => delIf(i)}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8 }}>
              <div><label style={etiquette}>Adressage</label><select style={champ} value={it.mode} onChange={e => setIf(i, { mode: e.target.value as 'dhcp' | 'static' })}><option value="static">Static</option><option value="dhcp">DHCP (client)</option></select></div>
              {it.mode === 'static' && <>
                <div><label style={etiquette}>Adresse IP</label><input style={{ ...champ, ...mono }} value={it.ip} onChange={e => setIf(i, { ip: e.target.value })} placeholder="192.168.10.254" /></div>
                <div><label style={etiquette}>CIDR</label><select style={champ} value={it.cidr} onChange={e => setIf(i, { cidr: e.target.value })}>{CIDRS.map(c => <option key={c} value={c}>/{c}</option>)}</select></div>
                {it.clef === 'wan' && <div><label style={etiquette}>Passerelle</label><input style={{ ...champ, ...mono }} value={it.gw} onChange={e => setIf(i, { gw: e.target.value })} placeholder="10.22.10.254" /></div>}
                {it.clef !== 'wan' && <>
                  <div><label style={etiquette}>DHCP début</label><input style={{ ...champ, ...mono }} value={it.dhcpFrom} onChange={e => setIf(i, { dhcpFrom: e.target.value })} placeholder="(vide = pas de DHCP)" /></div>
                  <div><label style={etiquette}>DHCP fin</label><input style={{ ...champ, ...mono }} value={it.dhcpTo} onChange={e => setIf(i, { dhcpTo: e.target.value })} placeholder="" /></div>
                </>}
              </>}
            </div>
          </div>
        ))}
        {interfaces.length < 5 && <button style={bouton} onClick={addIf}>+ Interface</button>}
      </div>

      <div style={groupe}>
        <div style={legende}>🏷️ Alias <span className="meta" style={{ fontWeight: 400 }}>— « nom type contenu » (type : network / host / port)</span></div>
        <textarea style={zone} value={aliases} onChange={e => persist(`${pfx}_alias`, e.target.value, setAliases)} spellCheck={false} />
      </div>

      <div style={groupe}>
        <div style={legende}>🔁 NAT — redirections de port <span className="meta" style={{ fontWeight: 400 }}>— « iface proto portPublic ipCible [portCible] description »</span></div>
        <textarea style={zone} value={nat} onChange={e => persist(`${pfx}_nat`, e.target.value, setNat)} spellCheck={false} />
      </div>

      <div style={groupe}>
        <div style={legende}>🛡️ Règles de filtrage <span className="meta" style={{ fontWeight: 400 }}>— « iface pass|block proto source destination [port] description »</span></div>
        <textarea style={zone} value={regles} onChange={e => persist(`${pfx}_regles`, e.target.value, setRegles)} spellCheck={false} />
        <div className="meta" style={{ fontSize: 11.5, marginTop: 6 }}>Source/destination : <code>any</code>, une IP, un réseau <code>a.b.c.0/24</code> ou le nom d’un alias. La première règle qui correspond gagne — blocages spécifiques au-dessus.</div>
      </div>

      <div style={groupe}>
        <div style={legende}>🛣️ Passerelles &amp; routes statiques <span className="meta" style={{ fontWeight: 400 }}>— « réseau/cidr passerelle description » par ligne</span></div>
        <textarea style={{ ...zone, minHeight: 60 }} value={routes} onChange={e => persist(`${pfx}_routes`, e.target.value, setRoutes)} spellCheck={false} placeholder="10.50.0.0/16 192.168.20.254 Vers le site distant" />
        <div className="meta" style={{ fontSize: 11.5, marginTop: 6 }}>La passerelle <strong>WAN</strong> vient de l’interface WAN (mode statique). Les routes statiques envoient un réseau non-connecté vers une passerelle interne.</div>
      </div>

      <div style={groupe}>
        <div style={legende}>🔒 VPN OpenVPN — accès nomade
          <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 400, cursor: 'pointer' }}>
            <input type="checkbox" checked={vpn} onChange={e => { setVpn(e.target.checked); lsSet(`${pfx}_vpn`, e.target.checked ? '1' : ''); }} /> activer
          </label>
        </div>
        {vpn ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
            <div><label style={etiquette}>Réseau du tunnel</label><input style={{ ...champ, ...mono }} value={vpnReseau} onChange={e => persist(`${pfx}_vpnres`, e.target.value, setVpnReseau)} placeholder="10.0.8.0/24" /></div>
            <div><label style={etiquette}>Réseaux internes poussés</label><input style={{ ...champ, ...mono }} value={vpnLocaux} onChange={e => persist(`${pfx}_vpnloc`, e.target.value, setVpnLocaux)} placeholder="192.168.10.0/24" /></div>
            <div><label style={etiquette}>Authentification</label><select style={champ} value={vpnAuth} onChange={e => persist(`${pfx}_vpnauth`, e.target.value, v => setVpnAuth(v as 'cert' | 'cert-user'))}><option value="cert-user">Certificat + compte</option><option value="cert">Certificat seul</option></select></div>
          </div>
        ) : (
          <div className="meta" style={{ fontSize: 12 }}>Coche « activer » pour ajouter le plan d’un serveur OpenVPN d’accès nomade (Remote Access) — certificats, réseau du tunnel, split tunnel, export du profil.</div>
        )}
      </div>

      {soucis.length > 0 && (
        <aside className="pb-note pb-note-red" style={{ marginBottom: 14 }}>
          <p className="pb-note-title">🚫 À corriger</p>
          <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>{soucis.map(s => <li key={s}>{s}</li>)}</ul>
        </aside>
      )}

      <aside className="pb-note pb-note-blue" style={{ marginBottom: 12 }}>
        <p className="pb-note-title">📋 Le plan de configuration (interface web de {APPLIANCE[variante]})</p>
        <p>Chaque bloc donne le <strong>chemin de menu</strong> et les <strong>valeurs de chaque champ</strong>, dans l’ordre. On configure {APPLIANCE[variante]} par son interface — il n’y a pas de « coller dans un terminal ».</p>
      </aside>

      {plan.map(sec => (
        <div key={sec.id} style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 6px', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>📜 {sec.titre}</div>
            <button type="button" onClick={() => copier(sec.id, sec.code)} style={{ ...bouton, background: copie === sec.id ? 'var(--accent)' : 'transparent', color: copie === sec.id ? '#fff' : 'var(--accent)' }}>{copie === sec.id ? '✓ Copié' : copie === 'sel-' + sec.id ? 'Ctrl+C' : 'Copier'}</button>
          </div>
          <Bloc code={sec.code} refPre={el => { pres.current[sec.id] = el; }} />
        </div>
      ))}

      {variante === 'pfsense' && xmls.length > 0 && (
        <>
          <aside className="pb-note pb-note-gray" style={{ margin: '18px 0 12px' }}>
            <p className="pb-note-title">⚡ Option rapide : restaurer le config.xml par zone</p>
            <p>pfSense sait restaurer <strong>une zone à la fois</strong> : <code>{RESTORE_MENU.pfsense}</code>. Colle (ou téléverse) le bloc, choisis la zone correspondante, Restore. Les <em>interfaces</em> ne sont pas incluses (les noms de cartes dépendent de ta machine) — fais-les avec le plan ci-dessus d’abord. Vérifie toujours après restauration.</p>
          </aside>
          {xmls.map(sec => (
            <div key={sec.id} style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 6px', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>🧩 {sec.titre} <span className="meta" style={{ fontWeight: 400, fontSize: 12 }}>(Restore area : {zoneRestore(sec.id)})</span></div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => telecharger(sec.code, `${sec.id.replace('xml-', '')}.xml`)} style={{ ...bouton, borderColor: 'var(--border)', color: 'var(--text)' }}>💾 .xml</button>
                  <button type="button" onClick={() => copier(sec.id, sec.code)} style={{ ...bouton, background: copie === sec.id ? 'var(--accent)' : 'transparent', color: copie === sec.id ? '#fff' : 'var(--accent)' }}>{copie === sec.id ? '✓ Copié' : 'Copier'}</button>
                </div>
              </div>
              <Bloc code={sec.code} refPre={el => { pres.current[sec.id] = el; }} />
            </div>
          ))}
        </>
      )}

      {variante === 'opnsense' && (
        <aside className="pb-note pb-note-gray" style={{ marginTop: 16 }}>
          <p className="pb-note-title">ℹ️ Et le config.xml ?</p>
          <p>OPNsense ne restaure une configuration que <strong>complète</strong> (<code>{RESTORE_MENU.opnsense}</code>), pas zone par zone depuis l’interface — on s’en tient donc au plan ci-dessus, qui est la façon normale de configurer le boîtier. La restauration partielle se fait en console (avancé).</p>
        </aside>
      )}
    </div>
  );
}

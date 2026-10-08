/**
 * Configurateur « agent Zabbix 2 » — îlot React (data-block="zabbix-agent-configurator").
 *
 * Génère le fichier zabbix_agent2.conf et l'installation (Debian ou Windows) d'un
 * agent à superviser depuis un serveur Zabbix : mode passif/actif, port, PSK.
 * Même famille que les autres configurateurs du site : mêmes boutons (copier,
 * « Pour la console », « Ligne curl », .sh).
 */
import { memo, useDeferredValue, useMemo, useRef, useState } from 'react';
import { deposerScript, lignesRecuperation } from '@/lib/partage-script';
import {
  genererZbx, pourConsoleZbx, ipValide, hostnameValide,
  type ParamsZbx, type OsCible, type ModeAgent,
} from '@/lib/zabbix-scripts';

const champ: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' };
const mono: React.CSSProperties = { fontFamily: "ui-monospace,'Space Mono',SFMono-Regular,Menlo,Consolas,monospace" };
const etiquette: React.CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 4 };
const groupe: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', background: 'var(--surface-2)', marginBottom: 14 };
const legende: React.CSSProperties = { fontWeight: 700, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const rangee: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 };
const bouton: React.CSSProperties = { padding: '6px 14px', border: '1px solid var(--accent)', borderRadius: 8, background: 'transparent', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' };
const pre: React.CSSProperties = { ...mono, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', overflowX: 'auto', fontSize: 12.5, lineHeight: 1.55, margin: 0, whiteSpace: 'pre' };
const check: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, cursor: 'pointer' };

const lsGet = (k: string, d: string) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* indisponible */ } };
const lsGetB = (k: string, d: boolean) => { try { const v = localStorage.getItem(k); return v === null ? d : v === '1'; } catch { return d; } };
const lsSetB = (k: string, v: boolean) => { try { localStorage.setItem(k, v ? '1' : '0'); } catch { /* indisponible */ } };

const Bloc = memo(function Bloc({ code, refPre }: { code: string; refPre: (el: HTMLPreElement | null) => void }) {
  return <pre ref={refPre} style={pre} tabIndex={0}><code>{code}</code></pre>;
});

/*
 * @id     tssr.atelier.zabbixConfigurator
 * @do     configurer_agent_zabbix
 * @role   ui
 * @layer  ui
 * @human  Atelier : agent Zabbix 2 (Debian/Windows, passif/actif, PSK) à superviser depuis un serveur Zabbix.
 */
export function ZabbixConfigurator() {
  const [os, setOs] = useState<OsCible>(() => (lsGet('zbx_os', 'debian') as OsCible));
  const [ipServeur, setIpServeur] = useState(() => lsGet('zbx_srv', '10.180.10.5'));
  const [hostname, setHostname] = useState(() => lsGet('zbx_host', 'SRV-WEB-01'));
  const [mode, setMode] = useState<ModeAgent>(() => (lsGet('zbx_mode', 'les-deux') as ModeAgent));
  const [listenPort, setListenPort] = useState(() => lsGet('zbx_port', '10050'));
  const [psk, setPsk] = useState(() => lsGetB('zbx_psk', false));
  const [pskIdentity, setPskIdentity] = useState(() => lsGet('zbx_pskid', ''));
  const [copie, setCopie] = useState('');
  const pres = useRef<Record<string, HTMLPreElement | null>>({});

  const persist = (k: string, v: string, set: (v: string) => void) => { set(v); lsSet(k, v); };

  const soucis = useMemo(() => {
    const s: string[] = [];
    if (!ipValide(ipServeur)) s.push(`L'IP du serveur Zabbix « ${ipServeur} » n'est pas une adresse IPv4.`);
    if (!hostnameValide(hostname)) s.push(`Le nom d'hôte « ${hostname} » est invalide (lettres, chiffres, . _ -).`);
    if (!/^\d{2,5}$/.test((listenPort || '').trim())) s.push('Le port d\'écoute doit être numérique (10050 par défaut).');
    if (psk && pskIdentity.trim() && !/^[\x21-\x7e]{1,128}$/.test(pskIdentity.trim())) s.push('La PSK identity ne doit pas contenir d\'espace.');
    return s;
  }, [ipServeur, hostname, listenPort, psk, pskIdentity]);

  const params = useDeferredValue(useMemo<ParamsZbx>(() => ({
    os, ipServeur, hostname, mode, listenPort, psk, pskIdentity, version: '7.4',
  }), [os, ipServeur, hostname, mode, listenPort, psk, pskIdentity]));
  const sections = useMemo(() => genererZbx(params), [params]);

  const [depot, setDepot] = useState<Record<string, string>>({});
  const partager = async (sec: { id: string; code: string }) => {
    setDepot(d => ({ ...d, [sec.id]: 'en cours' }));
    try {
      const r = await deposerScript('install-zabbix-agent.sh', sec.code);
      setDepot(d => ({ ...d, [sec.id]: lignesRecuperation(r.url, 'install-zabbix-agent.sh', true) }));
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
        <div style={legende}>📡 L'hôte à superviser</div>
        <div style={rangee}>
          <div><label style={etiquette}>Système</label><select style={champ} value={os} onChange={e => persist('zbx_os', e.target.value, v => setOs(v as OsCible))}><option value="debian">Debian / Ubuntu</option><option value="windows">Windows</option></select></div>
          <div><label style={etiquette}>Nom d'hôte (Hostname)</label><input style={{ ...champ, ...mono }} value={hostname} onChange={e => persist('zbx_host', e.target.value, setHostname)} placeholder="SRV-WEB-01" /></div>
          <div><label style={etiquette}>IP du serveur Zabbix</label><input style={{ ...champ, ...mono }} value={ipServeur} onChange={e => persist('zbx_srv', e.target.value, setIpServeur)} placeholder="10.180.10.5" /></div>
          <div><label style={etiquette}>Mode de l'agent</label><select style={champ} value={mode} onChange={e => persist('zbx_mode', e.target.value, v => setMode(v as ModeAgent))}><option value="les-deux">Passif + actif</option><option value="passif">Passif (Server=)</option><option value="actif">Actif (ServerActive=)</option></select></div>
          <div><label style={etiquette}>Port d'écoute</label><input style={{ ...champ, ...mono }} value={listenPort} onChange={e => persist('zbx_port', e.target.value, setListenPort)} placeholder="10050" /></div>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12 }}>
          <label style={check}><input type="checkbox" checked={psk} onChange={e => { setPsk(e.target.checked); lsSetB('zbx_psk', e.target.checked); }} /> Chiffrer avec une <strong>clé PSK</strong></label>
          {psk && <div style={{ flex: '1 1 200px' }}><input style={{ ...champ, ...mono }} value={pskIdentity} onChange={e => persist('zbx_pskid', e.target.value, setPskIdentity)} placeholder={'PSK identity (ex. PSK-' + (hostname.trim() || 'hote') + ')'} /></div>}
        </div>
        <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>
          <strong>Passif</strong> : le serveur interroge l'agent sur <code>{(listenPort || '10050').trim()}</code>/tcp. <strong>Actif</strong> : l'agent pousse ses données vers le serveur sur <code>10051</code>/tcp (utile derrière un NAT/pare-feu). En mode actif, le <code>Hostname=</code> de l'agent doit être <em>exactement</em> le « Host name » déclaré côté serveur.
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
              {sec.script && <button type="button" onClick={() => telecharger(sec.code, 'install-zabbix-agent.sh')} style={{ ...bouton, borderColor: 'var(--border)', color: 'var(--text)' }}>💾 .sh</button>}
              {sec.script && <button type="button" onClick={() => copier('console-' + sec.id, pourConsoleZbx(sec))} style={{ ...bouton, background: copie === 'console-' + sec.id ? 'var(--accent)' : 'transparent', color: copie === 'console-' + sec.id ? '#fff' : 'var(--accent)' }} title="Version qui s’enregistre dans ~/ et se lance">{copie === 'console-' + sec.id ? '✓ Copié' : '🖥️ Pour la console'}</button>}
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
        L'agent remonte des <strong>items</strong> (CPU, RAM, disque, services…) ; un <strong>template</strong>
        (« Linux by Zabbix agent » / « Windows by Zabbix agent ») en applique des dizaines d'un coup, avec leurs
        <strong> triggers</strong>. Voir la <a href="/pages/procedure-zabbix">procédure d'installation du serveur</a> et
        le <a href="/pages/zabbix-supervision">cours sur la supervision</a>.
      </div>
    </div>
  );
}

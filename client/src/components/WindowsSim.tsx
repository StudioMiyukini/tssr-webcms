import { useEffect, useMemo, useRef, useState } from 'react';
import { CmdConsole } from './CmdEmulator';

/**
 * Simulateur de bureau Windows Server / Hyper-V pour pratiquer LE PARCOURS (les clics
 * dans les interfaces graphiques) jusqu'à la fenêtre à configurer — souvent le point
 * faible en TP. Phase 1 : deux parcours complets, IP fixe (icône réseau → Connexions
 * réseau → clic droit Ethernet → Propriétés → TCP/IPv4) et Hyper-V (Gestionnaire de
 * serveur → Outils → Gestionnaire Hyper-V → Commutateur virtuel + Paramètres VM).
 * Indice du prochain clic, objectifs, et validation de la config à l'arrivée.
 * Îlot hydraté via RichContent (data-block="windows-sim").
 */

// ── Validation ──
const ipToNum = (ip: string): number | null => { const m = (ip || '').trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/); if (!m) return null; const o = [1, 2, 3, 4].map(i => Number(m[i])); if (o.some(n => n > 255)) return null; return ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0; };
const sameIp = (a: string, b: string) => { const na = ipToNum(a), nb = ipToNum(b); return na !== null && na === nb; };
const isEmptyIp = (v: string) => !v || !v.replace(/[.\s]/g, '');
const numEq = (v: string, n: number) => v.trim() !== '' && parseInt(v.replace(/[^\d]/g, ''), 10) === n;
const numEmpty = (v: string) => v.trim() === '';

// Cible de la Réalisation 1 (réseau interne isolé, pas de passerelle)
const IP_SRV = '192.168.10.250';
const MASK = '255.255.255.0';

type Mission = { id: string; icon: string; label: string; target: string; seq: { loc: string; elem: string }[]; need?: string };
const MISSIONS: Mission[] = [
  {
    id: 'ip', icon: '🌐', label: 'Donner une IP fixe au Serveur DNS/Web',
    target: 'tcpip',
    seq: [
      { loc: 'desktop', elem: 'systray-net' }, { loc: 'ov:net-flyout', elem: 'net-settings' },
      { loc: 'settings-net', elem: 'modif-cartes' }, { loc: 'ncpa', elem: 'rclick-eth' },
      { loc: 'ov:ctx-eth', elem: 'proprietes' }, { loc: 'eth-props', elem: 'proprietes-tcpip' },
    ],
  },
  {
    id: 'sw', icon: '🖧', label: 'Créer le commutateur virtuel « Interne »',
    target: 'vswitch',
    seq: [
      { loc: 'desktop', elem: 'tb-srvmgr' }, { loc: 'server-manager', elem: 'outils' },
      { loc: 'ov:tools', elem: 'hyperv' }, { loc: 'hyperv', elem: 'vswitch' },
    ],
  },
  {
    id: 'vm', icon: '🖥️', label: 'Régler mémoire & disque du Serveur DHCP',
    target: 'vm-settings',
    seq: [
      { loc: 'desktop', elem: 'tb-srvmgr' }, { loc: 'server-manager', elem: 'outils' },
      { loc: 'ov:tools', elem: 'hyperv' }, { loc: 'hyperv', elem: 'vm-params' },
    ],
  },
  {
    id: 'rename', icon: '🏷️', label: 'Renommer le poste (Nom de l’ordinateur)',
    target: 'rename-dlg',
    seq: [
      { loc: 'desktop', elem: 'rclick-thispc' }, { loc: 'ov:ctx-thispc', elem: 'proprietes-pc' },
      { loc: 'system', elem: 'modifier-params' }, { loc: 'sysprops', elem: 'modifier-nom' },
    ],
  },
  {
    id: 'roles', icon: '🧩', label: 'Installer les rôles DNS, DHCP et IIS',
    target: 'roles-wizard',
    seq: [
      { loc: 'desktop', elem: 'tb-srvmgr' }, { loc: 'server-manager', elem: 'gerer' }, { loc: 'ov:manage', elem: 'add-roles' },
    ],
  },
  {
    id: 'dns', icon: '🌐', label: 'DNS : créer la zone + enregistrements A', need: 'dns',
    target: 'dns-mgr',
    seq: [
      { loc: 'desktop', elem: 'tb-srvmgr' }, { loc: 'server-manager', elem: 'outils' }, { loc: 'ov:tools', elem: 'dns-tool' },
    ],
  },
  {
    id: 'dhcp', icon: '📶', label: 'DHCP : créer l’étendue (25 adresses)', need: 'dhcp',
    target: 'dhcp-mgr',
    seq: [
      { loc: 'desktop', elem: 'tb-srvmgr' }, { loc: 'server-manager', elem: 'outils' }, { loc: 'ov:tools', elem: 'dhcp-tool' },
    ],
  },
  {
    id: 'iis', icon: '🕸️', label: 'IIS : publier 2 sites (Présentation:80, intranet:8080)', need: 'iis',
    target: 'iis-mgr',
    seq: [
      { loc: 'desktop', elem: 'tb-srvmgr' }, { loc: 'server-manager', elem: 'outils' }, { loc: 'ov:tools', elem: 'iis-tool' },
    ],
  },
  {
    id: 'promote', icon: '🏰', label: 'Active Directory : promouvoir en contrôleur de domaine', need: 'ad',
    target: 'promote-dlg',
    seq: [ { loc: 'desktop', elem: 'tb-srvmgr' }, { loc: 'server-manager', elem: 'notif-flag' } ],
  },
  {
    id: 'join', icon: '🔗', label: 'Joindre le poste au domaine', need: 'domain',
    target: 'rename-dlg',
    seq: [
      { loc: 'desktop', elem: 'rclick-thispc' }, { loc: 'ov:ctx-thispc', elem: 'proprietes-pc' },
      { loc: 'system', elem: 'modifier-params' }, { loc: 'sysprops', elem: 'modifier-nom' },
    ],
  },
  {
    id: 'aduc', icon: '👥', label: 'AD : créer une OU + un utilisateur', need: 'domain',
    target: 'aduc',
    seq: [ { loc: 'desktop', elem: 'tb-srvmgr' }, { loc: 'server-manager', elem: 'outils' }, { loc: 'ov:tools', elem: 'aduc-tool' } ],
  },
  {
    id: 'gpo', icon: '🛡️', label: 'GPO : créer et lier une stratégie de groupe', need: 'domain',
    target: 'gpmc',
    seq: [ { loc: 'desktop', elem: 'tb-srvmgr' }, { loc: 'server-manager', elem: 'outils' }, { loc: 'ov:tools', elem: 'gpmc-tool' } ],
  },
];

const CSS = `
.ws{--w-face:#f0f0f0;color:#000;font-family:"Segoe UI",Tahoma,sans-serif;font-size:12.5px}
.ws *{box-sizing:border-box}
.ws-monitor{border:1px solid var(--border);border-radius:12px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.18)}
.ws-desk{position:relative;height:480px;background:linear-gradient(135deg,#0a3b6e,#124e86 45%,#0e6e8c);overflow:hidden}
.ws-icons{position:absolute;top:12px;left:12px;display:flex;flex-direction:column;gap:16px}
.ws-ic{width:74px;text-align:center;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.6);cursor:default;font-size:11.5px}
.ws-ic .g{font-size:30px;display:block}
.ws-stage{position:absolute;inset:0 0 40px 0;display:flex;align-items:center;justify-content:center;padding:14px;overflow:auto}
.ws-taskbar{position:absolute;left:0;right:0;bottom:0;height:40px;background:rgba(20,22,26,.92);display:flex;align-items:center;gap:4px;padding:0 8px;backdrop-filter:blur(4px)}
.ws-start{width:34px;height:30px;display:grid;place-items:center;border-radius:5px;cursor:pointer;color:#fff;font-size:17px}
.ws-start:hover,.ws-tbtn:hover{background:rgba(255,255,255,.14)}
.ws-tbtn{height:30px;display:flex;align-items:center;gap:6px;padding:0 10px;border-radius:5px;cursor:pointer;color:#e8e8e8;font-size:12px}
.ws-search{flex:0 1 190px;height:26px;background:#fff;border-radius:14px;display:flex;align-items:center;padding:0 12px;color:#666;font-size:11.5px;gap:6px}
.ws-tray{margin-left:auto;display:flex;align-items:center;gap:12px;color:#e8e8e8;font-size:12px;padding-right:6px}
.ws-tray span{cursor:pointer}
.ws-win{background:var(--w-face);border:1px solid #6f6f6f;border-radius:7px;box-shadow:0 12px 34px rgba(0,0,0,.4);width:min(560px,100%);max-height:100%;display:flex;flex-direction:column;overflow:hidden}
.ws-win.lg{width:min(680px,100%)}
.ws-tb{display:flex;align-items:center;gap:9px;background:#fff;border-bottom:1px solid #dcdcdc;padding:7px 10px;flex:0 0 auto}
.ws-tb .ic{font-size:14px}.ws-tb .tt{font-weight:600;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12.5px}
.ws-tb .cl{width:30px;height:20px;display:grid;place-items:center;color:#555;cursor:pointer;border-radius:4px}
.ws-tb .cl:hover{background:#e81123;color:#fff}
.ws-body{padding:14px 16px;overflow:auto}
.ws-foot{display:flex;justify-content:flex-end;gap:8px;padding:9px 12px;border-top:1px solid #e2e2e2;flex:0 0 auto}
.ws-btn{min-width:74px;padding:5px 12px;border:1px solid #adadad;border-radius:3px;background:linear-gradient(#fdfdfd,#e7e7e7);font-size:12.5px;cursor:pointer;font-family:inherit;color:#000}
.ws-btn:disabled{color:#999;cursor:default}
.ws-btn.def{border-color:#2b7de0;box-shadow:0 0 0 1px #cfe4ff inset}
.ws-hot{cursor:pointer}
.ws-pulse{animation:wspulse 1s ease-in-out infinite;outline:2px solid #ffb300;outline-offset:1px;border-radius:4px}
@keyframes wspulse{0%,100%{box-shadow:0 0 0 0 rgba(255,179,0,.7)}50%{box-shadow:0 0 0 6px rgba(255,179,0,0)}}
.ws-menu{position:absolute;background:#fff;border:1px solid #b7b7b7;box-shadow:0 8px 22px rgba(0,0,0,.28);border-radius:6px;padding:5px;min-width:210px;z-index:20}
.ws-mi{display:flex;align-items:center;gap:9px;padding:7px 10px;border-radius:5px;cursor:pointer;font-size:12.5px}
.ws-mi:hover{background:#eaf1fe}
.ws-mi.dis{color:#aaa;cursor:default}.ws-mi.dis:hover{background:transparent}
.ws-startmenu{position:absolute;left:6px;bottom:44px;width:280px;background:#1f2430;border:1px solid #0d1017;border-radius:8px;padding:8px;z-index:25;box-shadow:0 12px 34px rgba(0,0,0,.5)}
.ws-smi{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:6px;cursor:pointer;color:#eaeaea;font-size:12.5px}
.ws-smi:hover{background:rgba(255,255,255,.1)}
.ws-smi.dis{color:#7d818b;cursor:default}.ws-smi.dis:hover{background:transparent}
.ws-flyout{position:absolute;right:6px;bottom:44px;width:250px;background:#f7f9fb;border:1px solid #cfd6de;border-radius:8px;padding:12px;z-index:25;box-shadow:0 12px 34px rgba(0,0,0,.4)}
.ws-list{border:1px solid #7a7a7a;background:#fff;margin:6px 0}
.ws-lrow{display:flex;align-items:center;gap:8px;padding:6px 9px;border-bottom:1px solid #eee;cursor:pointer;font-size:12.5px}
.ws-lrow:hover{background:#eaf1fe}.ws-lrow.sel{background:#cfe0fb}
.ws-adapter{width:112px;text-align:center;padding:10px 6px;border:1px solid transparent;border-radius:6px;cursor:pointer}
.ws-adapter:hover{background:#eaf1fe;border-color:#bcd3f5}
.ws-adapter .big{font-size:30px}
.ws-row{display:flex;align-items:center;gap:10px;margin:7px 0}
.ws-row>label.lb{flex:0 0 150px}
.ws-in{border:1px solid #7a7a7a;background:#fff;padding:3px 6px;font-size:12.5px;font-family:inherit}
.ws-ipc{display:inline-flex;border:1px solid #7a7a7a;background:#fff}
.ws-ipc input{width:34px;border:0;text-align:center;font-size:12.5px;outline:none}
.ws-ipc .d{width:6px;text-align:center;font-weight:700}
.ws-crumb{font-size:11.5px;color:#334;background:#eef2f7;border:1px solid #dce3ec;border-radius:6px;padding:4px 9px;margin-bottom:8px;font-family:ui-monospace,monospace}
.ws-toast{position:absolute;left:50%;top:14px;transform:translateX(-50%);background:#c62828;color:#fff;padding:7px 14px;border-radius:8px;font-size:12.5px;z-index:40;box-shadow:0 6px 18px rgba(0,0,0,.35)}
.ws-appbody{display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:14px;align-items:start}
.ws-left{min-width:0}
.ws-right{display:flex;flex-direction:column;gap:12px}
.ws-toolbar{display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap}
.ws-launch{padding:8px 14px;border:1px solid var(--accent);border-radius:8px;background:var(--accent);color:#fff;font-weight:700;font-size:13px;cursor:pointer}
.ws-launch.alt{background:transparent;color:var(--accent)}
.ws-tip{font-size:11.5px;color:var(--text-muted);margin:6px 2px 0}
@media(max-width:820px){.ws-appbody{grid-template-columns:1fr}}
/* Mode « app » : fenêtre dédiée / plein écran (hauteurs explicites — le desk n'a que des enfants absolus) */
.ws-app{position:fixed;inset:0;z-index:2147483000;background:#0b0f14;display:flex;flex-direction:column;margin:0!important;padding:8px;gap:8px;overflow:hidden}
.ws-app .ws-appbody{flex:1 1 auto;min-height:0;display:flex;gap:10px}
.ws-app .ws-left{flex:1 1 auto;min-width:0;min-height:0;display:flex;flex-direction:column}
.ws-app .ws-right{flex:0 0 280px;min-height:0;overflow:auto;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px}
.ws-app .ws-monitor{flex:1 1 auto;min-width:0;min-height:0;display:block}
.ws-app .ws-monitor .ws-desk{height:calc(100vh - 64px)!important}
.ws-appbar{display:flex;align-items:center;gap:8px;color:#eaeaea;font-size:13px;padding:2px 4px}
.ws-appttl{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ws-appbtn{padding:6px 12px;border:1px solid #3a4250;border-radius:7px;background:#232a35;color:#eaeaea;font-size:12.5px;cursor:pointer;font-weight:600;white-space:nowrap}
.ws-appbtn:hover{background:#2d3644}
.ws-appbtn.danger:hover{background:#c62828;border-color:#c62828}
@media(max-width:820px){.ws-app .ws-appbody{flex-direction:column}.ws-app .ws-right{flex:0 0 auto}}
`;

// Contrôle IP 4 octets
function Ip({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const p = (value || '').split('.');
  const set = (i: number, raw: string) => { const nv = raw.replace(/\D/g, '').slice(0, 3); const o = [0, 1, 2, 3].map(k => p[k] ?? ''); o[i] = nv; onChange(o.every(x => x === '') ? '' : o.join('.')); };
  return <span className="ws-ipc">{[0, 1, 2, 3].map(i => <span key={i} style={{ display: 'inline-flex' }}>{i > 0 && <span className="d">.</span>}<input inputMode="numeric" disabled={disabled} value={p[i] ?? ''} onChange={e => set(i, e.target.value)} /></span>)}</span>;
}

const box: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-2)', padding: 12 };
const btnT: React.CSSProperties = { padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 7, background: 'transparent', color: 'var(--text)', fontWeight: 600, cursor: 'pointer', fontSize: 12.5 };

export function WindowsSim() {
  const [win, setWin] = useState('desktop');
  const [, setHist] = useState<string[]>([]);
  const [overlay, setOverlay] = useState<string | null>(null);
  const [tcpipSel, setTcpipSel] = useState(false);
  const [vmSel, setVmSel] = useState('');
  const [missionIdx, setMissionIdx] = useState(0);
  const [hintElem, setHintElem] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [done, setDone] = useState<Record<string, boolean>>({});
  // Modes « app » : fenêtre dédiée (overlay plein cadre) et plein écran (Fullscreen API).
  const wrapRef = useRef<HTMLDivElement>(null);
  const [appMode, setAppMode] = useState(false);
  const [fs, setFs] = useState(false);
  useEffect(() => { const h = () => setFs(!!document.fullscreenElement); document.addEventListener('fullscreenchange', h); return () => document.removeEventListener('fullscreenchange', h); }, []);
  const enterFs = () => { setAppMode(true); const el = wrapRef.current; if (el?.requestFullscreen) el.requestFullscreen().catch(() => {}); };
  const exitFsOnly = () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
  const toggleFs = () => (fs ? exitFsOnly() : enterFs());

  // Config (mission IP)
  const [ip, setIp] = useState(''); const [mask, setMask] = useState(''); const [gw, setGw] = useState(''); const [dns, setDns] = useState('');
  const [ipRes, setIpRes] = useState<string[] | null>(null);
  // Config (mission switch)
  const [swType, setSwType] = useState(''); const [swName, setSwName] = useState('COM_Int'); const [swRes, setSwRes] = useState<string[] | null>(null);
  // Config (mission VM)
  const [ram, setRam] = useState(''); const [dc, setDc] = useState(''); const [dd, setDd] = useState(''); const [vmRes, setVmRes] = useState<string[] | null>(null);
  // Renommage du poste (Propriétés système)
  const [pcName, setPcName] = useState('WIN-TSSR'); const [membership, setMembership] = useState<'wg' | 'dom'>('wg'); const [wgName, setWgName] = useState('WORKGROUP'); const [domName, setDomName] = useState('engineer.lan'); const [rnRes, setRnRes] = useState<string[] | null>(null);
  // Rôles installés (assistant Ajouter des rôles)
  const [roleChk, setRoleChk] = useState<Record<string, boolean>>({ dns: false, dhcp: false, iis: false, ad: false });
  const [installed, setInstalled] = useState<Record<string, boolean>>({ dns: false, dhcp: false, iis: false, ad: false, domain: false });
  const [rolesRes, setRolesRes] = useState<string[] | null>(null);
  // DNS (zone + enregistrements A + alias CNAME)
  const [dnsZone, setDnsZone] = useState(''); const [zoneOk, setZoneOk] = useState(false); const [dgZone, setDgZone] = useState('');
  const [aSrv, setASrv] = useState(''); const [aDhcp, setADhcp] = useState(''); const [aCli, setACli] = useState(''); const [cPres, setCPres] = useState(''); const [cIntra, setCIntra] = useState(''); const [dnsRes, setDnsRes] = useState<string[] | null>(null);
  // DHCP (nouvelle étendue + réservation)
  const [dhStart, setDhStart] = useState(''); const [dhEnd, setDhEnd] = useState(''); const [dhMask, setDhMask] = useState(''); const [dhDns, setDhDns] = useState(''); const [dhResv, setDhResv] = useState(''); const [dhcpRes, setDhcpRes] = useState<string[] | null>(null);
  // IIS (2 sites : Présentation:80 et intranet:8080)
  const [iisHost, setIisHost] = useState(''); const [iisPort, setIisPort] = useState('80'); const [iisHost2, setIisHost2] = useState(''); const [iisPort2, setIisPort2] = useState('8080'); const [iisRes, setIisRes] = useState<string[] | null>(null);
  // Active Directory
  const [adDomain, setAdDomain] = useState('engineer.lan'); const [adPromoted, setAdPromoted] = useState(false); const [promoteRes, setPromoteRes] = useState<string[] | null>(null);
  // AD : OU + utilisateur (ADUC)
  const [dgOu, setDgOu] = useState(''); const [ouName, setOuName] = useState(''); const [ouCreated, setOuCreated] = useState(false);
  const [uFirst, setUFirst] = useState(''); const [uLast, setULast] = useState(''); const [uLogin, setULogin] = useState(''); const [uPwd, setUPwd] = useState(''); const [aducRes, setAducRes] = useState<string[] | null>(null);
  // GPO (GPMC)
  const [gpoName, setGpoName] = useState(''); const [gpoLink, setGpoLink] = useState(''); const [gpoSetting, setGpoSetting] = useState(''); const [gpoRes, setGpoRes] = useState<string[] | null>(null);

  const mission = MISSIONS[missionIdx];
  const loc = overlay ? `ov:${overlay}` : win;

  const flashToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 1600); };
  const openWin = (to: string) => { setHist(h => [...h, win]); setWin(to); setOverlay(null); setHintElem(null); };
  const back = () => { setOverlay(null); setHist(h => { const n = [...h]; const prev = n.pop(); setWin(prev ?? 'desktop'); return n; }); setHintElem(null); };
  const toDesktop = () => { setWin('desktop'); setHist([]); setOverlay(null); setHintElem(null); };
  const miss = () => flashToast('❌ Pas par là — clique sur 💡 Indice');

  // Indice : prochain élément à cliquer pour la mission courante
  const hintNext = useMemo(() => {
    if (mission.need && !installed[mission.need]) return 'NEED';
    if (loc === mission.target) return 'AT';
    const entry = mission.seq.find(s => s.loc === loc);
    if (entry) {
      if (entry.elem === 'proprietes-tcpip' && !tcpipSel) return 'select-tcpip';
      if (entry.elem === 'vm-params' && !vmSel) return 'vm-row-srv-dhcp';
      return entry.elem;
    }
    return null; // hors chemin
  }, [mission, loc, tcpipSel, vmSel, installed]);
  const showHint = () => {
    if (hintNext === 'NEED') { flashToast('Installe d’abord le rôle — objectif « Installer les rôles ».'); return; }
    if (hintNext === 'AT') { flashToast('Tu es sur la bonne fenêtre — remplis puis clique OK / Installer.'); return; }
    if (hintNext) setHintElem(hintNext); else flashToast('Reviens en arrière (✕) puis suis le chemin depuis le bureau.');
  };
  const hp = (id: string) => `ws-hot${hintElem === id ? ' ws-pulse' : ''}`;

  const crumbMap: Record<string, string> = { desktop: 'Bureau', 'settings-net': 'Bureau › Paramètres › Réseau', 'control-panel': 'Bureau › Panneau de configuration', 'cp-net': 'Panneau › Réseau et Internet', 'net-center': 'Réseau › Centre Réseau et partage', ncpa: 'Réseau › Connexions réseau', 'eth-props': 'Ethernet › Propriétés', tcpip: 'Ethernet › TCP/IPv4', 'server-manager': 'Gestionnaire de serveur', hyperv: 'Gestionnaire Hyper-V', vswitch: 'Hyper-V › Commutateur virtuel', 'vm-settings': 'Hyper-V › Paramètres de la VM', system: 'Système', sysprops: 'Propriétés système › Nom de l’ordinateur', 'rename-dlg': 'Modification du nom de l’ordinateur', 'roles-wizard': 'Assistant Ajouter des rôles', 'dns-mgr': 'Gestionnaire DNS', 'dhcp-mgr': 'DHCP', 'iis-mgr': 'Gestionnaire IIS', 'promote-dlg': 'Assistant AD DS — Contrôleur de domaine', aduc: 'Utilisateurs et ordinateurs Active Directory', gpmc: 'Gestion des stratégies de groupe', cmd: 'Invite de commandes (cmd.exe)', powershell: 'Windows PowerShell' };

  // ── Validation des configs ──
  const checkIp = () => { const c = [
    { ok: sameIp(ip, IP_SRV), t: `Adresse IP = ${IP_SRV}` },
    { ok: sameIp(mask, MASK), t: `Masque = ${MASK}` },
    { ok: isEmptyIp(gw), t: 'Passerelle par défaut VIDE (réseau isolé)' },
    { ok: sameIp(dns, IP_SRV), t: `Serveur DNS préféré = ${IP_SRV}` },
  ]; setIpRes(c.map(x => `${x.ok ? '✓' : '✗'} ${x.t}`)); if (c.every(x => x.ok)) setDone(d => ({ ...d, ip: true })); };
  const checkSw = () => { const ok = swType === 'Interne'; setSwRes([`${ok ? '✓' : '✗'} Type = Interne (VM ↔ VM ET VM ↔ hôte)`, `${swName.trim() ? '✓' : '✗'} Nom du commutateur renseigné`]); if (ok && swName.trim()) setDone(d => ({ ...d, sw: true })); };
  const checkVm = () => { const c = [
    { ok: numEq(ram, 4096), t: 'Mémoire = 4096 Mo' },
    { ok: numEq(dc, 50), t: 'Disque C: = 50 Go' },
    { ok: numEmpty(dd), t: 'Pas de disque D: (SRV-DHCP = 1 disque)' },
  ]; setVmRes(c.map(x => `${x.ok ? '✓' : '✗'} ${x.t}`)); if (c.every(x => x.ok)) setDone(d => ({ ...d, vm: true })); };
  const checkRename = () => {
    if (mission.id === 'join') { const okDom = membership === 'dom' && domName.trim().toLowerCase() === adDomain.toLowerCase(); setRnRes([`${membership === 'dom' ? '✓' : '✗'} Option « Domaine » sélectionnée`, `${okDom ? '✓' : '✗'} Domaine = ${adDomain}`]); if (okDom) setDone(d => ({ ...d, join: true })); return; }
    const okName = /^[A-Za-z0-9-]{1,15}$/.test(pcName.trim()) && pcName.trim().toUpperCase() !== 'WIN-TSSR'; const okMem = membership === 'wg';
    setRnRes([`${okName ? '✓' : '✗'} Nouveau nom valide (lettres/chiffres/-, ≤15 — ex. SRV-DNS-WEB)`, `${okMem ? '✓' : '✗'} Membre d’un « Groupe de travail » (le domaine se joindra après AD)`]); if (okName && okMem) setDone(d => ({ ...d, rename: true }));
  };
  const checkRoles = () => { const need3 = roleChk.dns && roleChk.dhcp && roleChk.iis; setRolesRes([`${roleChk.dns ? '✓' : '✗'} Rôle DNS`, `${roleChk.dhcp ? '✓' : '✗'} Rôle DHCP`, `${roleChk.iis ? '✓' : '✗'} Rôle Serveur Web (IIS)`, `${roleChk.ad ? '✓ Rôle AD DS' : 'ℹ️ AD DS non coché (optionnel — pour Active Directory)'}`]); setInstalled(p => ({ ...p, dns: p.dns || roleChk.dns, dhcp: p.dhcp || roleChk.dhcp, iis: p.iis || roleChk.iis, ad: p.ad || roleChk.ad })); if (need3) setDone(d => ({ ...d, roles: true })); };
  const checkPromote = () => { const ok = /^[a-z0-9-]+\.[a-z]{2,}$/i.test(adDomain.trim()); setPromoteRes([`${ok ? '✓' : '✗'} Nouvelle forêt — domaine racine « ${adDomain} »`, ok ? '✓ Serveur promu contrôleur de domaine (DNS AD intégré)' : '✗ Nom de domaine FQDN attendu (ex. engineer.lan)']); if (ok) { setAdPromoted(true); setInstalled(p => ({ ...p, domain: true })); setDone(d => ({ ...d, promote: true })); } };
  const checkDns = () => { const c = [
    { ok: zoneOk && /\.lan$/i.test(dnsZone.trim()), t: 'Zone de recherche directe créée (…​.lan)' },
    { ok: sameIp(aSrv, '192.168.10.250'), t: 'Hôte (A) serveur → 192.168.10.250' },
    { ok: sameIp(aDhcp, '192.168.10.251'), t: 'Hôte (A) dhcp → 192.168.10.251' },
    { ok: sameIp(aCli, '192.168.10.101'), t: 'Hôte (A) client-w → 192.168.10.101' },
    { ok: /serveur|srv|www|\.250/i.test(cPres), t: 'Alias CNAME presentation → serveur' },
    { ok: /serveur|srv|www|\.250/i.test(cIntra), t: 'Alias CNAME intranet → serveur' },
  ]; setDnsRes(c.map(x => `${x.ok ? '✓' : '✗'} ${x.t}`)); if (c.every(x => x.ok)) setDone(d => ({ ...d, dns: true })); };
  const checkDhcp = () => { const s = ipToNum(dhStart), e = ipToNum(dhEnd), r = ipToNum(dhResv); const cnt = (s !== null && e !== null && e >= s) ? e - s + 1 : -1; const rOk = r !== null && s !== null && e !== null && r >= s && r <= e; const c = [
    { ok: cnt === 25, t: 'Plage = 25 adresses (ex. .111 → .135)' },
    { ok: sameIp(dhMask, '255.255.255.0'), t: 'Masque = 255.255.255.0' },
    { ok: sameIp(dhDns, '192.168.10.250'), t: 'Option 006 (DNS) = 192.168.10.250' },
    { ok: rOk, t: 'Réservation du client comprise dans la plage' },
  ]; setDhcpRes(c.map(x => `${x.ok ? '✓' : '✗'} ${x.t}`)); if (c.every(x => x.ok)) setDone(d => ({ ...d, dhcp: true })); };
  const checkIis = () => { const c = [
    { ok: /presentation/i.test(iisHost) && /\.lan$/i.test(iisHost.trim()), t: 'Site Présentation : hôte presentation.<domaine>.lan' },
    { ok: iisPort.trim() === '80', t: 'Présentation : port 80' },
    { ok: /intranet/i.test(iisHost2) && /\.lan$/i.test(iisHost2.trim()), t: 'Site intranet : hôte intranet.<domaine>.lan' },
    { ok: iisPort2.trim() === '8080', t: 'intranet : port 8080 (2 sites, même IP, distingués par le nom d’hôte)' },
  ]; setIisRes(c.map(x => `${x.ok ? '✓' : '✗'} ${x.t}`)); if (c.every(x => x.ok)) setDone(d => ({ ...d, iis: true })); };

  const checkAduc = () => { const okPwd = uPwd.length >= 8 && /[A-Z]/.test(uPwd) && /[a-z]/.test(uPwd) && /[0-9]/.test(uPwd); const c = [
    { ok: ouCreated && ouName.trim() !== '', t: `Unité d'organisation créée${ouName ? ' (' + ouName + ')' : ''}` },
    { ok: uFirst.trim() !== '' && uLast.trim() !== '', t: 'Utilisateur : prénom + nom renseignés' },
    { ok: uLogin.trim() !== '', t: 'Nom d’ouverture de session (ex. prenom.nom)' },
    { ok: okPwd, t: 'Mot de passe conforme (≥ 8, majuscule, minuscule, chiffre)' },
  ]; setAducRes(c.map(x => `${x.ok ? '✓' : '✗'} ${x.t}`)); if (c.every(x => x.ok)) setDone(d => ({ ...d, aduc: true })); };
  const checkGpo = () => { const c = [
    { ok: gpoName.trim() !== '', t: 'Nom de la GPO renseigné' },
    { ok: gpoLink !== '' && gpoLink === ouName && ouName !== '', t: `GPO liée à l'OU ${ouName || '(crée d’abord l’OU)'} — pas au domaine entier` },
    { ok: gpoSetting.trim() !== '', t: 'Au moins un paramètre configuré (Modifier…)' },
  ]; setGpoRes(c.map(x => `${x.ok ? '✓' : '✗'} ${x.t}`)); if (c.every(x => x.ok)) setDone(d => ({ ...d, gpo: true })); };

  const resObj: string[] | null = ({ ip: ipRes, sw: swRes, vm: vmRes, rename: rnRes, roles: rolesRes, promote: promoteRes, dns: dnsRes, dhcp: dhcpRes, iis: iisRes, join: rnRes, aduc: aducRes, gpo: gpoRes } as Record<string, string[] | null>)[mission.id] ?? null;
  const allDone = MISSIONS.every(m => done[m.id]);

  // ── Rendu de la fenêtre active ──
  const Win = ({ icon, title, children, footer, wide }: { icon: string; title: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) => (
    <div className={`ws-win${wide ? ' lg' : ''}`}>
      <div className="ws-tb"><span className="ic">{icon}</span><span className="tt">{title}</span><span className="cl" onClick={back} title="Fermer">✕</span></div>
      <div className="ws-body">{children}</div>
      {footer && <div className="ws-foot">{footer}</div>}
    </div>
  );

  const renderWin = () => {
    switch (win) {
      case 'settings-net': return <Win icon="⚙️" title="Paramètres — Réseau et Internet › État">
        <p style={{ margin: '0 0 10px' }}><b>Ethernet</b> — Connecté</p>
        <div className={hp('modif-cartes')} onClick={() => openWin('ncpa')} style={{ color: '#0067c0', cursor: 'pointer', padding: '6px 0' }} data-hid="modif-cartes">🖧 Modifier les options d’adaptateur</div>
        <div style={{ color: '#0067c0', padding: '6px 0' }} onClick={miss}>Options de partage</div>
        <div style={{ color: '#0067c0', padding: '6px 0' }} onClick={miss}>Centre Réseau et partage</div>
      </Win>;
      case 'control-panel': return <Win icon="🎛️" title="Panneau de configuration" wide>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className={hp('reseau-internet')} onClick={() => openWin('cp-net')} data-hid="reseau-internet" style={{ cursor: 'pointer', padding: 8 }}>🌐 <b style={{ color: '#0067c0' }}>Réseau et Internet</b></div>
          <div onClick={miss} style={{ padding: 8 }}>🛡️ Système et sécurité</div>
          <div onClick={miss} style={{ padding: 8 }}>🖨️ Matériel et audio</div>
          <div onClick={miss} style={{ padding: 8 }}>👤 Comptes d’utilisateurs</div>
        </div>
      </Win>;
      case 'cp-net': return <Win icon="🌐" title="Réseau et Internet">
        <div className={hp('centre-reseau')} onClick={() => openWin('net-center')} data-hid="centre-reseau" style={{ cursor: 'pointer', padding: 8, color: '#0067c0' }}>🖧 <b>Centre Réseau et partage</b></div>
        <div onClick={miss} style={{ padding: 8 }}>Options Internet</div>
        <div onClick={miss} style={{ padding: 8 }}>Groupe résidentiel</div>
      </Win>;
      case 'net-center': return <Win icon="🖧" title="Centre Réseau et partage">
        <div style={{ display: 'flex', gap: 14 }}>
          <div style={{ flex: '0 0 170px', borderRight: '1px solid #ddd', paddingRight: 10 }}>
            <div className={hp('modif-cartes')} onClick={() => openWin('ncpa')} data-hid="modif-cartes" style={{ color: '#0067c0', cursor: 'pointer', padding: '5px 0' }}>Modifier les paramètres de la carte</div>
            <div onClick={miss} style={{ color: '#0067c0', padding: '5px 0' }}>Modifier les paramètres de partage avancés</div>
          </div>
          <div style={{ flex: 1 }}><p style={{ margin: 0 }}>Afficher les informations de base de votre réseau.</p></div>
        </div>
      </Win>;
      case 'ncpa': return <Win icon="🖧" title="Connexions réseau">
        <p className="ws-crumb">Panneau de configuration › Réseau et Internet › Connexions réseau</p>
        <p style={{ margin: '0 0 8px', fontSize: 12, color: '#555' }}>Clique <b>droit</b> sur la carte <b>Ethernet</b> → <b>Propriétés</b>.</p>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className={`ws-adapter ${hp('rclick-eth')}`} data-hid="rclick-eth" onContextMenu={e => { e.preventDefault(); setOverlay('ctx-eth'); setHintElem(null); }} onClick={e => { e.preventDefault(); setOverlay('ctx-eth'); setHintElem(null); }}>
            <div className="big">🔌</div><div><b>Ethernet</b></div><div style={{ fontSize: 11, color: '#555' }}>Réseau Hyper-V</div>
          </div>
          <div className="ws-adapter" onClick={miss} style={{ opacity: .8 }}>
            <div className="big">📶</div><div><b>Wi-Fi</b></div><div style={{ fontSize: 11, color: '#a00' }}>Non connecté</div>
          </div>
        </div>
      </Win>;
      case 'eth-props': return <Win icon="🔌" title="Propriétés de Ethernet" footer={<>
        <button className="ws-btn" onClick={() => tcpipSel ? openWin('tcpip') : miss()} disabled={!tcpipSel} data-hid="proprietes-tcpip">Propriétés</button>
        <button className="ws-btn" onClick={back}>Annuler</button></>}>
        <p style={{ margin: '0 0 8px', fontSize: 12 }}>Cette connexion utilise les éléments suivants :</p>
        <div className="ws-list">
          {['Client pour les réseaux Microsoft', 'Partage de fichiers et imprimantes', 'Protocole Internet version 4 (TCP/IPv4)', 'Protocole Internet version 6 (TCP/IPv6)'].map((it, i) => {
            const isV4 = i === 2;
            return <div key={i} className={`ws-lrow${isV4 && tcpipSel ? ' sel' : ''} ${isV4 ? hp('select-tcpip') : ''}`} data-hid={isV4 ? 'select-tcpip' : undefined}
              onClick={() => { if (isV4) { setTcpipSel(true); setHintElem(null); } else miss(); }}>
              <input type="checkbox" defaultChecked readOnly /> {it}
            </div>;
          })}
        </div>
        <p style={{ fontSize: 11.5, color: '#555', margin: '8px 0 0' }}>Sélectionne <b>Protocole Internet version 4 (TCP/IPv4)</b> puis clique <b>Propriétés</b>.</p>
      </Win>;
      case 'tcpip': return <Win icon="🌐" title="Propriétés de : Protocole Internet version 4 (TCP/IPv4)" footer={<>
        <button className="ws-btn def" onClick={checkIp}>OK</button><button className="ws-btn" onClick={back}>Annuler</button></>}>
        <p style={{ fontSize: 11.5, color: '#333', margin: '0 0 8px' }}>Machine : <b>SRV-DNS-WEB</b> (réseau interne isolé — pas de passerelle).</p>
        <label style={{ display: 'flex', gap: 7, margin: '4px 0' }}><input type="radio" readOnly /> Obtenir une adresse IP automatiquement</label>
        <label style={{ display: 'flex', gap: 7, margin: '4px 0' }}><input type="radio" checked readOnly /> Utiliser l’adresse IP suivante :</label>
        <div className="ws-row" style={{ marginLeft: 24 }}><label className="lb">Adresse IP :</label><Ip value={ip} onChange={setIp} /></div>
        <div className="ws-row" style={{ marginLeft: 24 }}><label className="lb">Masque de sous-réseau :</label><Ip value={mask} onChange={setMask} /></div>
        <div className="ws-row" style={{ marginLeft: 24 }}><label className="lb">Passerelle par défaut :</label><Ip value={gw} onChange={setGw} /></div>
        <label style={{ display: 'flex', gap: 7, margin: '8px 0 4px' }}><input type="radio" checked readOnly /> Utiliser l’adresse de serveur DNS suivante :</label>
        <div className="ws-row" style={{ marginLeft: 24 }}><label className="lb">Serveur DNS préféré :</label><Ip value={dns} onChange={setDns} /></div>
      </Win>;
      case 'server-manager': return <Win icon="🗄️" title="Gestionnaire de serveur" wide footer={<span style={{ marginRight: 'auto', fontSize: 11.5, color: '#666' }}>Tableau de bord</span>}>
        {installed.ad && !adPromoted && <div className={hp('notif-flag')} data-hid="notif-flag" onClick={() => openWin('promote-dlg')} style={{ cursor: 'pointer', background: '#fff4ce', border: '1px solid #e6c200', borderRadius: 6, padding: '7px 10px', marginBottom: 8, fontSize: 12 }}>⚠️ Configuration post-déploiement pour <b>AD DS</b> — <b>Promouvoir ce serveur en contrôleur de domaine</b> →</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 10 }}>
          <span className={`ws-btn ${hp('gerer')}`} data-hid="gerer" onClick={() => { setOverlay('manage'); setHintElem(null); }} style={{ cursor: 'pointer' }}>Gérer ▾</span>
          <span className={`ws-btn ${hp('outils')}`} data-hid="outils" onClick={() => { setOverlay('tools'); setHintElem(null); }} style={{ cursor: 'pointer' }}>Outils ▾</span>
        </div>
        <div style={{ border: '1px solid #d6d6d6', borderRadius: 6, padding: 14, background: '#fafafa' }}>
          <p style={{ margin: 0 }}>Bienvenue dans le Gestionnaire de serveur</p>
          <p style={{ fontSize: 12, color: '#666' }}>Pour ouvrir une console (Hyper-V, DNS, DHCP, IIS…), utilise le menu <b>Outils</b> en haut à droite.</p>
        </div>
      </Win>;
      case 'hyperv': return <Win icon="🖥️" title="Gestionnaire Hyper-V" wide footer={<>
        <button className={`ws-btn ${hp('vswitch')}`} data-hid="vswitch" onClick={() => openWin('vswitch')}>Gestionnaire de commutateur virtuel…</button>
        <button className={`ws-btn ${hp('vm-params')}`} data-hid="vm-params" onClick={() => vmSel ? openWin('vm-settings') : flashToast('Sélectionne d’abord une VM dans la liste.')} disabled={!vmSel}>Paramètres…</button>
      </>}>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 6px', fontSize: 12, color: '#555' }}>Ordinateurs virtuels — hôte <b>WIN-TSSR</b> :</p>
            <div className="ws-list">
              {['SRV-DNS-WEB', 'SRV-DHCP', 'CLIENT-W'].map(vm => (
                <div key={vm} className={`ws-lrow${vmSel === vm ? ' sel' : ''} ${vm === 'SRV-DHCP' ? hp('vm-row-srv-dhcp') : ''}`} data-hid={vm === 'SRV-DHCP' ? 'vm-row-srv-dhcp' : undefined} onClick={() => { setVmSel(vm); setHintElem(null); }}>🖥️ {vm} <span style={{ marginLeft: 'auto', fontSize: 11, color: '#0a7d28' }}>● En fonction</span></div>
              ))}
            </div>
            <p style={{ fontSize: 11.5, color: '#555', margin: '8px 0 0' }}>Objectif VM : sélectionne <b>SRV-DHCP</b> puis <b>Paramètres…</b> (volet Actions à droite).</p>
          </div>
          <div style={{ flex: '0 0 150px', borderLeft: '1px solid #ddd', paddingLeft: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#555', margin: '0 0 6px' }}>Actions</p>
            <p style={{ fontSize: 11.5, color: '#777' }}>(les actions sont aussi dans la barre du bas)</p>
          </div>
        </div>
      </Win>;
      case 'vswitch': return <Win icon="🖧" title="Gestionnaire de commutateur virtuel" wide footer={<>
        <button className="ws-btn def" onClick={checkSw}>OK</button><button className="ws-btn" onClick={back}>Annuler</button></>}>
        <p style={{ fontSize: 11.5, color: '#333', margin: '0 0 10px' }}>Nouveau commutateur réseau virtuel — choisis le <b>type</b> :</p>
        {[['Externe', 'Accès à la carte physique / Internet'], ['Interne', 'VM entre elles ET avec l’hôte'], ['Privé', 'VM entre elles uniquement (pas l’hôte)']].map(([v, d]) => (
          <label key={v} style={{ display: 'flex', gap: 8, margin: '6px 0', alignItems: 'flex-start' }}><input type="radio" name="wsw" checked={swType === v} onChange={() => setSwType(v)} /><span><b>{v}</b> — {d}</span></label>
        ))}
        <div className="ws-row" style={{ marginTop: 8 }}><label className="lb">Nom :</label><input className="ws-in" style={{ width: 180 }} value={swName} onChange={e => setSwName(e.target.value)} /></div>
      </Win>;
      case 'vm-settings': return <Win icon="🖥️" title={`Paramètres de « ${vmSel || 'SRV-DHCP'} »`} wide footer={<>
        <button className="ws-btn def" onClick={checkVm}>OK</button><button className="ws-btn" onClick={back}>Annuler</button></>}>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: '0 0 140px', borderRight: '1px solid #ddd', paddingRight: 8, fontSize: 12 }}>
            <p style={{ fontWeight: 700, margin: '0 0 6px' }}>Matériel</p>
            <div style={{ color: '#0067c0' }}>Mémoire</div><div style={{ color: '#0067c0' }}>Processeur</div><div style={{ color: '#0067c0' }}>Contrôleur SCSI</div>
            <div style={{ marginLeft: 10, color: '#555' }}>Disque dur (C:)</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ border: '1px solid #ddd', borderRadius: 6, padding: 10, marginBottom: 10 }}>
              <b style={{ fontSize: 12 }}>Mémoire</b>
              <div className="ws-row"><label className="lb">Mémoire de démarrage :</label><input className="ws-in" style={{ width: 80 }} value={ram} onChange={e => setRam(e.target.value)} placeholder="4096" /> Mo</div>
            </div>
            <div style={{ border: '1px solid #ddd', borderRadius: 6, padding: 10 }}>
              <b style={{ fontSize: 12 }}>Disques durs (VHDX)</b>
              <div className="ws-row"><label className="lb">Disque 1 — système (C:) :</label><input className="ws-in" style={{ width: 64 }} value={dc} onChange={e => setDc(e.target.value)} placeholder="50" /> Go</div>
              <div className="ws-row"><label className="lb">Disque 2 (D:) :</label><input className="ws-in" style={{ width: 64 }} value={dd} onChange={e => setDd(e.target.value)} placeholder="vide" /> Go</div>
            </div>
          </div>
        </div>
      </Win>;
      case 'system': return <Win icon="💻" title="Système" wide>
        <div style={{ display: 'flex', gap: 14 }}>
          <div style={{ flex: '0 0 180px', borderRight: '1px solid #ddd', paddingRight: 10, fontSize: 12 }}>
            <div className={hp('modifier-params')} data-hid="modifier-params" onClick={() => openWin('sysprops')} style={{ color: '#0067c0', cursor: 'pointer', padding: '5px 0' }}>⚙️ Paramètres système avancés</div>
            <div onClick={miss} style={{ color: '#0067c0', padding: '5px 0' }}>Gestionnaire de périphériques</div>
            <div onClick={miss} style={{ color: '#0067c0', padding: '5px 0' }}>Protection du système</div>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 8px', fontWeight: 700 }}>Paramètres de nom d’ordinateur, de domaine et de groupe de travail</p>
            <div style={{ fontSize: 12.5 }}><span style={{ color: '#555' }}>Nom de l’ordinateur : </span><b>{pcName}</b></div>
            <div style={{ fontSize: 12.5 }}><span style={{ color: '#555' }}>Groupe de travail : </span>{wgName}</div>
            <div className={hp('modifier-params')} data-hid="modifier-params" onClick={() => openWin('sysprops')} style={{ color: '#0067c0', cursor: 'pointer', marginTop: 8 }}>🔧 Modifier les paramètres</div>
          </div>
        </div>
      </Win>;
      case 'sysprops': return <Win icon="💻" title="Propriétés système" footer={<><button className="ws-btn" onClick={back}>OK</button><button className="ws-btn" onClick={back}>Annuler</button></>}>
        <div style={{ display: 'flex', gap: 2, marginBottom: 10, fontSize: 11.5 }}>
          {['Nom de l’ordinateur', 'Matériel', 'Paramètres système avancés', 'À distance'].map((t, i) => <span key={t} style={{ padding: '5px 9px', border: '1px solid #ccc', background: i === 0 ? '#f0f0f0' : '#e4e4e4', borderRadius: '4px 4px 0 0' }}>{t}</span>)}
        </div>
        <p style={{ fontSize: 12.5 }}>Windows utilise ces informations pour identifier votre ordinateur sur le réseau.</p>
        <div className="ws-row"><label className="lb">Nom complet :</label><b>{pcName}</b></div>
        <div className="ws-row"><label className="lb">Groupe de travail :</label>{wgName}</div>
        <p style={{ fontSize: 11.5, color: '#555' }}>Pour renommer cet ordinateur ou modifier son domaine, cliquez sur Modifier.</p>
        <div style={{ textAlign: 'right' }}><button className={`ws-btn ${hp('modifier-nom')}`} data-hid="modifier-nom" onClick={() => openWin('rename-dlg')}>Modifier…</button></div>
      </Win>;
      case 'rename-dlg': return <Win icon="💻" title="Modification du nom ou du domaine de l’ordinateur" footer={<><button className="ws-btn def" onClick={checkRename}>OK</button><button className="ws-btn" onClick={back}>Annuler</button></>}>
        <p style={{ fontSize: 12 }}>Vous pouvez modifier le nom et l’appartenance de cet ordinateur.</p>
        <div className="ws-row"><label className="lb">Nom de l’ordinateur :</label><input className="ws-in" style={{ width: 180 }} value={pcName} onChange={e => setPcName(e.target.value)} /></div>
        <div style={{ border: '1px solid #ccc', borderRadius: 4, padding: '8px 10px', marginTop: 8 }}>
          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700 }}>Membre d’un</p>
          <label style={{ display: 'flex', gap: 7, margin: '4px 0' }}><input type="radio" checked={membership === 'dom'} onChange={() => setMembership('dom')} /> Domaine :</label>
          <input className="ws-in" style={{ width: 180, marginLeft: 22 }} value={domName} onChange={e => setDomName(e.target.value)} disabled={membership !== 'dom'} />
          <label style={{ display: 'flex', gap: 7, margin: '8px 0 4px' }}><input type="radio" checked={membership === 'wg'} onChange={() => setMembership('wg')} /> Groupe de travail :</label>
          <input className="ws-in" style={{ width: 180, marginLeft: 22 }} value={wgName} onChange={e => setWgName(e.target.value)} disabled={membership !== 'wg'} />
        </div>
        <p style={{ fontSize: 11, color: '#666', marginTop: 8 }}>ℹ️ Le domaine <b>{domName}</b> ne pourra être rejoint qu’<b>après l’installation d’Active Directory</b>. Pour l’instant : Groupe de travail.</p>
      </Win>;
      case 'roles-wizard': return <Win icon="🧩" title="Assistant Ajouter des rôles et fonctionnalités — Rôles de serveurs" wide footer={<><button className="ws-btn def" onClick={checkRoles}>Installer</button><button className="ws-btn" onClick={back}>Annuler</button></>}>
        <p style={{ fontSize: 12 }}>Sélectionnez un ou plusieurs rôles à installer sur le serveur.</p>
        {([['dns', 'Serveur DNS'], ['dhcp', 'Serveur DHCP'], ['iis', 'Serveur Web (IIS)'], ['ad', 'Services AD DS (Active Directory)']] as [string, string][]).map(([k, label]) => (
          <label key={k} style={{ display: 'flex', gap: 8, margin: '6px 0' }}><input type="checkbox" checked={!!roleChk[k]} onChange={e => setRoleChk(r => ({ ...r, [k]: e.target.checked }))} /> {label}{installed[k] && <span style={{ color: '#0a7d28', fontSize: 11 }}> (déjà installé)</span>}</label>
        ))}
        <p style={{ fontSize: 11.5, color: '#555', marginTop: 6 }}>Coche les <b>3 rôles</b> puis <b>Installer</b> — ils apparaîtront dans le menu <b>Outils</b>.</p>
      </Win>;
      case 'dns-mgr': return <Win icon="🌐" title="Gestionnaire DNS" wide footer={<button className="ws-btn def" onClick={checkDns}>Vérifier</button>}>
        <p style={{ fontSize: 12, color: '#555' }}>Serveur <b>WIN-TSSR</b> › <b>Zones de recherche directe</b></p>
        {!zoneOk ? (
          <div style={{ border: '1px solid #ddd', borderRadius: 6, padding: 10, margin: '8px 0' }}>
            <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700 }}>Nouvelle zone (recherche directe, principale)</p>
            <div className="ws-row"><label className="lb">Nom de la zone :</label><input className="ws-in" style={{ width: 180 }} value={dgZone} onChange={e => setDgZone(e.target.value)} placeholder="engineer.lan" /></div>
            <button className="ws-btn" style={{ marginTop: 6 }} onClick={() => { if (dgZone.trim()) { setDnsZone(dgZone.trim()); setZoneOk(true); } }}>Créer la zone</button>
          </div>
        ) : (<>
          <div className="ws-list" style={{ margin: '8px 0' }}><div className="ws-lrow"><b>{dnsZone}</b><span style={{ marginLeft: 'auto', fontSize: 11, color: '#555' }}>zone principale</span></div></div>
          <p style={{ fontSize: 11.5, color: '#555', margin: '0 0 4px' }}>Clic droit sur la zone → « Nouvel hôte (A)… ». Ajoute un enregistrement A par machine :</p>
          <table style={{ width: '100%', fontSize: 12.5 }}><tbody>
            <tr><td style={{ padding: '3px 6px' }}>serveur (A) →</td><td><Ip value={aSrv} onChange={setASrv} /></td></tr>
            <tr><td style={{ padding: '3px 6px' }}>dhcp (A) →</td><td><Ip value={aDhcp} onChange={setADhcp} /></td></tr>
            <tr><td style={{ padding: '3px 6px' }}>client-w (A) →</td><td><Ip value={aCli} onChange={setACli} /></td></tr>
          </tbody></table>
          <p style={{ fontSize: 11.5, color: '#555', margin: '8px 0 4px' }}>Puis « Nouvel alias (CNAME)… » pour les noms de sites web :</p>
          <table style={{ width: '100%', fontSize: 12.5 }}><tbody>
            <tr><td style={{ padding: '3px 6px' }}>presentation (CNAME) →</td><td><input className="ws-in" style={{ width: 160 }} value={cPres} onChange={e => setCPres(e.target.value)} placeholder="serveur" /></td></tr>
            <tr><td style={{ padding: '3px 6px' }}>intranet (CNAME) →</td><td><input className="ws-in" style={{ width: 160 }} value={cIntra} onChange={e => setCIntra(e.target.value)} placeholder="serveur" /></td></tr>
          </tbody></table>
        </>)}
      </Win>;
      case 'dhcp-mgr': return <Win icon="📶" title="DHCP — Assistant Nouvelle étendue" wide footer={<button className="ws-btn def" onClick={checkDhcp}>Vérifier</button>}>
        <p style={{ fontSize: 12, color: '#555' }}>IPv4 › clic droit → <b>Nouvelle étendue…</b> — plage d’adresses à distribuer :</p>
        <div className="ws-row"><label className="lb">Adresse IP de début :</label><Ip value={dhStart} onChange={setDhStart} /></div>
        <div className="ws-row"><label className="lb">Adresse IP de fin :</label><Ip value={dhEnd} onChange={setDhEnd} /></div>
        <div className="ws-row"><label className="lb">Masque de sous-réseau :</label><Ip value={dhMask} onChange={setDhMask} /></div>
        <div className="ws-row"><label className="lb">Option 006 (DNS) :</label><Ip value={dhDns} onChange={setDhDns} /></div>
        <div className="ws-row"><label className="lb">Réservation client :</label><Ip value={dhResv} onChange={setDhResv} /></div>
        {(() => { const s = ipToNum(dhStart), e = ipToNum(dhEnd); const n = (s !== null && e !== null && e >= s) ? e - s + 1 : null; return n !== null && <p style={{ fontSize: 12, color: n === 25 ? '#0a7d28' : '#c1121f', marginTop: 6 }}>Plage : <b>{n}</b> adresse(s) (objectif : 25). La réservation doit être <b>dans</b> cette plage.</p>; })()}
      </Win>;
      case 'iis-mgr': return <Win icon="🕸️" title="Gestionnaire IIS — Ajouter un site Web" wide footer={<button className="ws-btn def" onClick={checkIis}>Vérifier</button>}>
        <p style={{ fontSize: 12, color: '#555' }}>Sites › clic droit → <b>Ajouter un site Web…</b> — crée les <b>2 sites</b> (même IP <code>.250</code>, distingués par le <b>nom d’hôte</b>) :</p>
        <div style={{ border: '1px solid #ddd', borderRadius: 6, padding: 8, marginBottom: 8 }}>
          <b style={{ fontSize: 12 }}>Site 1 — Présentation</b>
          <div className="ws-row"><label className="lb">Nom d’hôte :</label><input className="ws-in" style={{ width: 220 }} value={iisHost} onChange={e => setIisHost(e.target.value)} placeholder="presentation.engineer.lan" /></div>
          <div className="ws-row"><label className="lb">Port :</label><input className="ws-in" style={{ width: 64 }} value={iisPort} onChange={e => setIisPort(e.target.value)} /></div>
        </div>
        <div style={{ border: '1px solid #ddd', borderRadius: 6, padding: 8 }}>
          <b style={{ fontSize: 12 }}>Site 2 — intranet</b>
          <div className="ws-row"><label className="lb">Nom d’hôte :</label><input className="ws-in" style={{ width: 220 }} value={iisHost2} onChange={e => setIisHost2(e.target.value)} placeholder="intranet.engineer.lan" /></div>
          <div className="ws-row"><label className="lb">Port :</label><input className="ws-in" style={{ width: 64 }} value={iisPort2} onChange={e => setIisPort2(e.target.value)} /></div>
        </div>
      </Win>;
      case 'promote-dlg': return <Win icon="🏰" title="Assistant Configuration des services de domaine Active Directory" wide footer={<><button className="ws-btn def" onClick={checkPromote}>Installer</button><button className="ws-btn" onClick={back}>Annuler</button></>}>
        <p style={{ fontSize: 12 }}>Sélectionnez l’opération de déploiement :</p>
        <label style={{ display: 'flex', gap: 7, margin: '4px 0' }}><input type="radio" checked readOnly /> Ajouter une nouvelle forêt</label>
        <label style={{ display: 'flex', gap: 7, margin: '4px 0', color: '#999' }}><input type="radio" readOnly /> Ajouter un contrôleur de domaine à un domaine existant</label>
        <div className="ws-row" style={{ marginLeft: 22 }}><label className="lb">Nom de domaine racine :</label><input className="ws-in" style={{ width: 180 }} value={adDomain} onChange={e => setAdDomain(e.target.value)} placeholder="engineer.lan" /></div>
        <p style={{ fontSize: 11.5, color: '#555', marginTop: 6 }}>Crée le domaine et promeut ce serveur en <b>contrôleur de domaine</b> (DNS Active Directory intégré). Ensuite, tu pourras <b>joindre les postes au domaine</b>.</p>
      </Win>;
      case 'aduc': return <Win icon="👥" title="Utilisateurs et ordinateurs Active Directory" wide footer={<button className="ws-btn def" onClick={checkAduc}>Vérifier</button>}>
        <p style={{ fontSize: 12, color: '#555' }}>Domaine <b>{adDomain}</b></p>
        {!ouCreated ? (
          <div style={{ border: '1px solid #ddd', borderRadius: 6, padding: 10, margin: '8px 0' }}>
            <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700 }}>Clic droit sur le domaine → Nouveau → Unité d’organisation</p>
            <div className="ws-row"><label className="lb">Nom de l’OU :</label><input className="ws-in" style={{ width: 190 }} value={dgOu} onChange={e => setDgOu(e.target.value)} placeholder="Utilisateurs_EDIVN" /></div>
            <label style={{ display: 'flex', gap: 6, fontSize: 11.5, margin: '6px 0' }}><input type="checkbox" defaultChecked readOnly /> Protéger le conteneur contre une suppression accidentelle</label>
            <button className="ws-btn" style={{ marginTop: 4 }} onClick={() => { if (dgOu.trim()) { setOuName(dgOu.trim()); setOuCreated(true); } }}>Créer l’OU</button>
          </div>
        ) : (<>
          <div className="ws-list" style={{ margin: '8px 0' }}><div className="ws-lrow">📁 <b>{ouName}</b><span style={{ marginLeft: 'auto', fontSize: 11, color: '#555' }}>unité d’organisation</span></div></div>
          <p style={{ fontSize: 11.5, color: '#555', margin: '0 0 4px' }}>Clic droit sur l’OU → Nouveau → <b>Utilisateur</b> :</p>
          <div className="ws-row"><label className="lb">Prénom :</label><input className="ws-in" style={{ width: 130 }} value={uFirst} onChange={e => setUFirst(e.target.value)} /><label className="lb" style={{ flex: '0 0 auto' }}>Nom :</label><input className="ws-in" style={{ width: 130 }} value={uLast} onChange={e => setULast(e.target.value)} /></div>
          <div className="ws-row"><label className="lb">Nom d’ouverture de session :</label><input className="ws-in" style={{ width: 150 }} value={uLogin} onChange={e => setULogin(e.target.value)} placeholder="prenom.nom" /><span style={{ fontSize: 12 }}>@{adDomain}</span></div>
          <div className="ws-row"><label className="lb">Mot de passe :</label><input className="ws-in" style={{ width: 150 }} value={uPwd} onChange={e => setUPwd(e.target.value)} placeholder="≥ 8, Maj+min+chiffre" /></div>
          <label style={{ display: 'flex', gap: 6, fontSize: 11.5, margin: '6px 0' }}><input type="checkbox" defaultChecked readOnly /> L’utilisateur doit changer le mot de passe à la prochaine ouverture de session</label>
        </>)}
      </Win>;
      case 'gpmc': return <Win icon="🛡️" title="Gestion des stratégies de groupe" wide footer={<button className="ws-btn def" onClick={checkGpo}>Vérifier</button>}>
        <p style={{ fontSize: 12, color: '#555' }}>Forêt {adDomain} › Domaines › {adDomain}{ouName ? ' › ' + ouName : ''}</p>
        <p style={{ fontSize: 11.5, color: '#555' }}>Clic droit sur une <b>OU</b> → « Créer un objet GPO dans ce domaine, et le lier ici… »</p>
        <div className="ws-row"><label className="lb">Nom de la GPO :</label><input className="ws-in" style={{ width: 200 }} value={gpoName} onChange={e => setGpoName(e.target.value)} placeholder="Verrouillage postes" /></div>
        <div className="ws-row"><label className="lb">Lier à :</label>
          <select className="ws-in" value={gpoLink} onChange={e => setGpoLink(e.target.value)}>
            <option value="">— choisir —</option>
            {ouName && <option value={ouName}>OU : {ouName}</option>}
            <option value="__domain">{adDomain} (domaine entier)</option>
          </select>
        </div>
        <div className="ws-row"><label className="lb">Paramètre (Modifier…) :</label>
          <select className="ws-in" value={gpoSetting} onChange={e => setGpoSetting(e.target.value)}>
            <option value="">— aucun —</option>
            <option>Longueur minimale du mot de passe</option>
            <option>Interdire l’accès au Panneau de configuration</option>
            <option>Fond d’écran du Bureau imposé</option>
            <option>Empêcher l’accès aux outils de modification du Registre</option>
          </select>
        </div>
        <p style={{ fontSize: 11, color: '#666', marginTop: 6 }}>💡 Bonne pratique : lier la GPO à une <b>OU</b> (pas au domaine entier). Après « Modifier » les paramètres, <code>gpupdate /force</code> sur le poste pour appliquer.</p>
      </Win>;
      case 'cmd': return <Win icon="⬛" title="Invite de commandes — cmd.exe" wide>
        <p style={{ fontSize: 11.5, color: '#555', margin: '0 0 8px' }}>Terminal réel (bac à sable) : <code>ipconfig</code>, <code>ping</code>, <code>nslookup</code>, <code>netsh</code>, <code>net</code>, <code>netdom</code>… L’état de la machine réagit.</p>
        <CmdConsole shell="cmd" height={340} />
      </Win>;
      case 'powershell': return <Win icon="⚡" title="Administrateur : Windows PowerShell" wide>
        <p style={{ fontSize: 11.5, color: '#555', margin: '0 0 8px' }}>Cmdlets : <code>New-NetIPAddress</code>, <code>Set-DnsClientServerAddress</code>, <code>Rename-Computer</code>, <code>Test-NetConnection</code>… (les commandes cmd fonctionnent aussi).</p>
        <CmdConsole shell="powershell" height={340} />
      </Win>;
      default: return null;
    }
  };

  return (
    <div ref={wrapRef} className={`ws${appMode ? ' ws-app' : ''}`} style={appMode ? undefined : { margin: '14px 0' }}>
      <style>{CSS}</style>
      {appMode && (
        <div className="ws-appbar">
          <span className="ws-appttl">🖥️ Simulateur TSSR — Réalisation 1 · parcours Windows / Hyper-V</span>
          <span style={{ flex: 1 }} />
          <button className="ws-appbtn" onClick={toggleFs}>{fs ? '🡇 Quitter le plein écran' : '⛶ Plein écran'}</button>
          {!fs && <button className="ws-appbtn" onClick={() => setAppMode(false)}>🗗 Réduire</button>}
          <button className="ws-appbtn danger" onClick={() => { exitFsOnly(); setAppMode(false); }}>✕ Fermer</button>
        </div>
      )}
      <div className="ws-appbody">
        <div className="ws-left">
          {!appMode && (
            <div className="ws-toolbar">
              <button className="ws-launch" onClick={enterFs}>⛶ Plein écran</button>
              <button className="ws-launch alt" onClick={() => setAppMode(true)}>🗗 Ouvrir en fenêtre dédiée</button>
            </div>
          )}
          <div className="ws-monitor">
          <div className="ws-desk">
            {/* Icônes bureau */}
            <div className="ws-icons">
              <div className="ws-ic" onClick={miss}><span className="g">🗑️</span>Corbeille</div>
              <div className={`ws-ic ${hp('rclick-thispc')}`} data-hid="rclick-thispc" onContextMenu={e => { e.preventDefault(); setOverlay('ctx-thispc'); setHintElem(null); }} onClick={() => { setOverlay('ctx-thispc'); setHintElem(null); }}><span className="g">💻</span>Ce PC</div>
              <div className="ws-ic" onClick={() => openWin('cmd')}><span className="g">⬛</span>Invite de commandes</div>
              <div className="ws-ic" onClick={() => openWin('powershell')}><span className="g">⚡</span>PowerShell</div>
            </div>
            {/* Fenêtre active */}
            {win !== 'desktop' && <div className="ws-stage">{renderWin()}</div>}
            {win === 'desktop' && <div className="ws-stage"><div style={{ color: '#dbe7f5', textAlign: 'center', maxWidth: 340 }}><div style={{ fontSize: 40 }}>🖥️</div><p style={{ margin: '6px 0 0', textShadow: '0 1px 3px rgba(0,0,0,.6)' }}>Windows Server — bureau. Choisis un objectif à droite, puis suis le parcours (💡 Indice si tu bloques).</p></div></div>}

            {/* Menu contextuel Ethernet */}
            {overlay === 'ctx-eth' && <div className="ws-menu" style={{ left: 120, top: 150 }} onMouseLeave={() => {}}>
              {['Désactiver', 'État', 'Diagnostiquer', 'Renommer'].map(x => <div key={x} className="ws-mi" onClick={() => { setOverlay(null); miss(); }}>{x}</div>)}
              <div className={`ws-mi ${hp('proprietes')}`} data-hid="proprietes" onClick={() => openWin('eth-props')} style={{ fontWeight: 700 }}>⚙️ Propriétés</div>
            </div>}

            {/* Menu contextuel « Ce PC » */}
            {overlay === 'ctx-thispc' && <div className="ws-menu" style={{ left: 78, top: 74 }}>
              {['Ouvrir', 'Épingler à l’accès rapide', 'Gérer', 'Connecter un lecteur réseau'].map(x => <div key={x} className="ws-mi" onClick={() => { setOverlay(null); miss(); }}>{x}</div>)}
              <div className={`ws-mi ${hp('proprietes-pc')}`} data-hid="proprietes-pc" onClick={() => openWin('system')} style={{ fontWeight: 700 }}>⚙️ Propriétés</div>
            </div>}

            {/* Menu Gérer (Server Manager) */}
            {overlay === 'manage' && <div className="ws-menu" style={{ right: 92, top: 60 }}>
              <div className={`ws-mi ${hp('add-roles')}`} data-hid="add-roles" onClick={() => openWin('roles-wizard')}>🧩 Ajouter des rôles et fonctionnalités</div>
              <div className="ws-mi dis">Supprimer des rôles et fonctionnalités</div>
            </div>}

            {/* Menu Outils (Server Manager) */}
            {overlay === 'tools' && <div className="ws-menu" style={{ right: 30, top: 60 }}>
              <div className={`ws-mi ${hp('hyperv')}`} data-hid="hyperv" onClick={() => openWin('hyperv')}>🖥️ Gestionnaire Hyper-V</div>
              {installed.dns ? <div className={`ws-mi ${hp('dns-tool')}`} data-hid="dns-tool" onClick={() => openWin('dns-mgr')}>🌐 DNS</div> : <div className="ws-mi dis">🌐 DNS <span style={{ marginLeft: 'auto', fontSize: 10 }}>(installer le rôle)</span></div>}
              {installed.dhcp ? <div className={`ws-mi ${hp('dhcp-tool')}`} data-hid="dhcp-tool" onClick={() => openWin('dhcp-mgr')}>📶 DHCP</div> : <div className="ws-mi dis">📶 DHCP <span style={{ marginLeft: 'auto', fontSize: 10 }}>(installer le rôle)</span></div>}
              {installed.iis ? <div className={`ws-mi ${hp('iis-tool')}`} data-hid="iis-tool" onClick={() => openWin('iis-mgr')}>🕸️ Gestionnaire IIS</div> : <div className="ws-mi dis">🕸️ Gestionnaire IIS <span style={{ marginLeft: 'auto', fontSize: 10 }}>(installer le rôle)</span></div>}
              {installed.domain ? <div className={`ws-mi ${hp('aduc-tool')}`} data-hid="aduc-tool" onClick={() => openWin('aduc')}>👥 Utilisateurs et ordinateurs Active Directory</div> : <div className="ws-mi dis">👥 Utilisateurs et ordinateurs AD <span style={{ marginLeft: 'auto', fontSize: 10 }}>(promouvoir AD)</span></div>}
              {installed.domain ? <div className={`ws-mi ${hp('gpmc-tool')}`} data-hid="gpmc-tool" onClick={() => openWin('gpmc')}>🛡️ Gestion des stratégies de groupe</div> : <div className="ws-mi dis">🛡️ Gestion des stratégies de groupe <span style={{ marginLeft: 'auto', fontSize: 10 }}>(promouvoir AD)</span></div>}
            </div>}

            {/* Menu Démarrer */}
            {overlay === 'start' && <div className="ws-startmenu">
              <div className="ws-smi" onClick={() => openWin('server-manager')}>🗄️ Gestionnaire de serveur</div>
              <div className="ws-smi" onClick={() => openWin('control-panel')}>🎛️ Panneau de configuration</div>
              <div className="ws-smi" onClick={() => openWin('hyperv')}>🖥️ Gestionnaire Hyper-V</div>
              <div className="ws-smi" onClick={() => openWin('cmd')}>⬛ Invite de commandes</div>
              <div className="ws-smi" onClick={() => openWin('powershell')}>⚡ Windows PowerShell</div>
              <div className="ws-smi" onClick={() => setOverlay(null)}>⏻ Fermer le menu</div>
            </div>}

            {/* Flyout réseau */}
            {overlay === 'net-flyout' && <div className="ws-flyout">
              <p style={{ margin: '0 0 6px', fontWeight: 600 }}>🔌 Ethernet</p>
              <p style={{ margin: '0 0 10px', fontSize: 11.5, color: '#555' }}>Connecté</p>
              <div className={hp('net-settings')} data-hid="net-settings" onClick={() => openWin('settings-net')} style={{ color: '#0067c0', cursor: 'pointer' }}>⚙️ Paramètres réseau et Internet</div>
            </div>}

            {toast && <div className="ws-toast">{toast}</div>}

            {/* Barre des tâches */}
            <div className="ws-taskbar">
              <div className="ws-start" onClick={() => setOverlay(overlay === 'start' ? null : 'start')} title="Démarrer">⊞</div>
              <div className="ws-search">🔍 Rechercher</div>
              <div className={`ws-tbtn ${hp('tb-srvmgr')}`} data-hid="tb-srvmgr" onClick={() => openWin('server-manager')} title="Gestionnaire de serveur">🗄️ <span style={{ fontSize: 11 }}>Serveur</span></div>
              <div className="ws-tbtn" onClick={() => openWin('powershell')} title="Windows PowerShell">⚡ <span style={{ fontSize: 11 }}>PowerShell</span></div>
              <div className="ws-tray">
                <span className={hp('systray-net')} data-hid="systray-net" onClick={() => setOverlay(overlay === 'net-flyout' ? null : 'net-flyout')} title="Réseau">🖧</span>
                <span onClick={miss}>🔊</span>
                <span onClick={miss} style={{ fontSize: 11 }}>10:24<br />13/07/2026</span>
              </div>
            </div>
          </div>
          </div>
          {!appMode && <p className="ws-tip">Astuce : le <b>clic droit</b> sur la carte Ethernet ouvre son menu. Bouton <b>✕</b> pour fermer une fenêtre.</p>}
        </div>

        {/* Panneau objectifs */}
        <div className="ws-right">
        <div style={box}>
          <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 8 }}>🎯 Objectifs (parcours)</div>
          {MISSIONS.map((mm, i) => {
            const locked = !!mm.need && !installed[mm.need];
            return (
              <button key={mm.id} onClick={() => { setMissionIdx(i); setHintElem(null); }} style={{ display: 'flex', gap: 8, width: '100%', textAlign: 'left', alignItems: 'flex-start', padding: '8px 10px', marginBottom: 6, borderRadius: 8, cursor: 'pointer', border: `1px solid ${i === missionIdx ? 'var(--accent)' : 'var(--border)'}`, background: i === missionIdx ? 'var(--accent-light,rgba(37,99,235,.08))' : 'var(--surface)', color: 'var(--text)' }}>
                <span>{done[mm.id] ? '✅' : locked ? '🔒' : mm.icon}</span>
                <span style={{ fontSize: 12.5, lineHeight: 1.35 }}>{mm.label}{done[mm.id] && <b style={{ color: '#16a34a' }}> — fait</b>}{locked && !done[mm.id] && <em style={{ color: 'var(--text-muted)' }}> — installe le rôle d’abord</em>}</span>
              </button>
            );
          })}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button style={{ ...btnT, borderColor: 'var(--accent)', color: 'var(--accent)', flex: 1 }} onClick={showHint}>💡 Indice</button>
            <button style={btnT} onClick={toDesktop} title="Revenir au bureau">🏠</button>
          </div>
        </div>

        <div style={box}>
          <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 6 }}>📍 Où suis-je</div>
          <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{crumbMap[win] || 'Bureau'}{overlay ? ' (menu ouvert)' : ''}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>Objectif : <b>{mission.label}</b></div>
        </div>

        {resObj && <div style={{ ...box, border: `1px solid ${done[mission.id] ? '#16a34a' : 'var(--border)'}` }}>
          <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 6, color: done[mission.id] ? '#16a34a' : 'var(--text)' }}>{done[mission.id] ? '✅ Fenêtre bien configurée !' : '📝 Vérification'}</div>
          {resObj.map((l, i) => <div key={i} style={{ fontSize: 12.5, color: l.startsWith('✓') ? '#16a34a' : '#dc2626', margin: '2px 0' }}>{l}</div>)}
          {done[mission.id] && <button style={{ ...btnT, marginTop: 8 }} onClick={toDesktop}>Revenir au bureau →</button>}
        </div>}

        {allDone && <div style={{ ...box, border: '2px solid #16a34a', textAlign: 'center' }}>
          <div style={{ fontSize: 22 }}>🏆</div><b>Les 3 parcours réussis !</b>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>Tu maîtrises le chemin jusqu’à chaque fenêtre. (DNS, IIS, DHCP arrivent en phase 2.)</div>
        </div>}
        </div>
      </div>
    </div>
  );
}

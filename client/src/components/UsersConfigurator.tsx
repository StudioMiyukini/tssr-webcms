/**
 * Configurateur « utilisateurs, groupes, arborescence & droits » — îlot React
 * (data-block="users-configurator").
 *
 * À partir de listes de groupes, d'utilisateurs (avec leurs groupes) et d'une
 * arborescence annotée de droits, produit un script qui crée les groupes et les
 * comptes, pose les dossiers/fichiers, applique chown/chmod (récursif au
 * besoin), et un bloc de vérification. Mêmes briques et mêmes boutons que les
 * autres configurateurs.
 */
import { memo, useDeferredValue, useMemo, useRef, useState } from 'react';
import { deposerScript, lignesRecuperation } from '@/lib/partage-script';
import {
  genererScriptsUsers, listeGroupes, listeUtilisateurs, listeArbo, tousLesGroupes,
  pourConsoleUsers, MDP, type ParamsUsers,
} from '@/lib/users-scripts';

const champ: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' };
const mono: React.CSSProperties = { fontFamily: "ui-monospace,'Space Mono',SFMono-Regular,Menlo,Consolas,monospace" };
const etiquette: React.CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 4 };
const groupe: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', background: 'var(--surface-2)', marginBottom: 14 };
const legende: React.CSSProperties = { fontWeight: 700, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const bouton: React.CSSProperties = { padding: '6px 14px', border: '1px solid var(--accent)', borderRadius: 8, background: 'transparent', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' };
const pre: React.CSSProperties = { ...mono, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', overflowX: 'auto', fontSize: 12.5, lineHeight: 1.55, margin: 0, whiteSpace: 'pre' };
const zone: React.CSSProperties = { ...champ, ...mono, minHeight: 120, resize: 'vertical', fontSize: 12.5, lineHeight: 1.5 };

const lsGet = (k: string, d: string) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* indisponible */ } };

const D_GROUPES = 'administration\ndirection\ntechnique\nmaquettiste\ndessinateur\ningenieur';
const D_USERS = [
  'jack administration direction technique',
  'vala administration direction',
  'samantha administration',
  'daniel technique',
  'tealc technique dessinateur',
  'aiden technique maquettiste',
  'teyla technique maquettiste',
  'john technique ingenieur',
  'rodney technique ingenieur',
  'eliza technique ingenieur',
].join('\n');
const D_ARBO = [
  '/home/partage/                 root:root         2775 R',
  '/home/partage/direction/       root:direction    2770 R',
  '/home/partage/technique/       root:technique    2770 R',
  '/home/partage/plans/           tealc:dessinateur 2770 R',
  '/home/partage/maquettes/       root:maquettiste  2770 R',
  '/home/partage/ingenierie/      root:ingenieur    2770 R',
  '/home/partage/direction/note.txt',
].join('\n');

const Bloc = memo(function Bloc({ code, refPre }: { code: string; refPre: (el: HTMLPreElement | null) => void }) {
  return <pre ref={refPre} style={pre} tabIndex={0}><code>{code}</code></pre>;
});

/*
 * @id     tssr.atelier.usersConfigurator
 * @do     configurer_comptes_droits
 * @role   ui
 * @layer  ui
 * @human  Atelier : utilisateurs, groupes, arborescence et droits (chown/chmod).
 */
export function UsersConfigurator() {
  const [groupes, setGroupes] = useState(() => lsGet('usr_groupes', D_GROUPES));
  const [utilisateurs, setUsers] = useState(() => lsGet('usr_users', D_USERS));
  const [arbo, setArbo] = useState(() => lsGet('usr_arbo', D_ARBO));
  const [motDePasse, setMdp] = useState(true);
  const [shell, setShell] = useState(() => lsGet('usr_shell', '/bin/bash'));
  const [copie, setCopie] = useState('');
  const pres = useRef<Record<string, HTMLPreElement | null>>({});

  const persist = (k: string, v: string, set: (v: string) => void) => { set(v); lsSet(k, v); };
  const lG = useMemo(() => listeGroupes(groupes), [groupes]);
  const lU = useMemo(() => listeUtilisateurs(utilisateurs), [utilisateurs]);
  const lA = useMemo(() => listeArbo(arbo), [arbo]);
  const tousG = useMemo(() => tousLesGroupes({ groupes, utilisateurs } as ParamsUsers), [groupes, utilisateurs]);
  const groupesImplicites = tousG.filter(g => !lG.includes(g));

  const soucis = useMemo(() => {
    const s: string[] = [];
    if (!lU.length) s.push('Aucun utilisateur valide (un login en minuscules par ligne, puis ses groupes).');
    const dirs = new Set(lA.filter(n => n.dir).map(n => n.path.replace(/\/$/, '')));
    for (const n of lA.filter(x => !x.dir)) {
      const parent = n.path.replace(/\/[^/]*$/, '');
      if (parent && !dirs.has(parent) && !lA.some(d => d.dir && n.path.startsWith(d.path))) {
        // fichier dont le dossier parent n'est pas déclaré : le script le créera (mkdir -p), simple info
      }
    }
    for (const n of lA) {
      if (n.group && !tousG.includes(n.group)) s.push(`Le dossier ${n.path} a pour groupe « ${n.group} », qui n’est pas dans la liste des groupes.`);
      if (n.owner && !lU.some(u => u.login === n.owner) && n.owner !== 'root') s.push(`Le dossier ${n.path} a pour propriétaire « ${n.owner} », qui n’est pas un utilisateur créé.`);
    }
    return s.slice(0, 6);
  }, [lU, lA, tousG]);

  const params = useDeferredValue(useMemo<ParamsUsers>(() => ({ groupes, utilisateurs, arbo, motDePasse, shell: shell.trim() || '/bin/bash' }),
    [groupes, utilisateurs, arbo, motDePasse, shell]));
  const sections = useMemo(() => genererScriptsUsers(params), [params]);

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
        <div style={legende}>👥 Groupes <span className="meta" style={{ fontWeight: 400 }}>(un par ligne)</span></div>
        <textarea style={{ ...zone, minHeight: 96 }} value={groupes} onChange={e => persist('usr_groupes', e.target.value, setGroupes)} spellCheck={false} />
        <div className="meta" style={{ fontSize: 11.5, marginTop: 6 }}>{lG.length} groupe{lG.length > 1 ? 's' : ''} déclaré{lG.length > 1 ? 's' : ''}{groupesImplicites.length ? <> — et {groupesImplicites.length} créé{groupesImplicites.length > 1 ? 's' : ''} via les utilisateurs : {groupesImplicites.map(g => <code key={g} style={{ marginRight: 4 }}>{g}</code>)}</> : '.'}</div>
      </div>

      <div style={groupe}>
        <div style={legende}>🧑‍💼 Utilisateurs <span className="meta" style={{ fontWeight: 400 }}>— « login groupe1 groupe2 … » (le login d’abord, puis ses groupes secondaires)</span></div>
        <textarea style={zone} value={utilisateurs} onChange={e => persist('usr_users', e.target.value, setUsers)} spellCheck={false} />
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, cursor: 'pointer' }}><input type="checkbox" checked={motDePasse} onChange={e => setMdp(e.target.checked)} /> Mot de passe {MDP} sur chaque compte</label>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5 }}><span style={{ color: 'var(--text-soft)', fontSize: 12.5, fontWeight: 600 }}>Shell</span><input style={{ ...champ, ...mono, width: 130, padding: '5px 8px' }} value={shell} onChange={e => persist('usr_shell', e.target.value, setShell)} placeholder="/bin/bash" /></span>
          <span className="meta" style={{ fontSize: 12.5 }}>{lU.length} utilisateur{lU.length > 1 ? 's' : ''}</span>
        </div>
      </div>

      <div style={groupe}>
        <div style={legende}>🌳 Arborescence &amp; droits</div>
        <textarea style={zone} value={arbo} onChange={e => persist('usr_arbo', e.target.value, setArbo)} spellCheck={false} />
        <div className="meta" style={{ fontSize: 11.5, marginTop: 6, lineHeight: 1.6 }}>
          Une ligne = <code>chemin&nbsp;absolu&nbsp;[proprietaire:groupe]&nbsp;[mode]&nbsp;[R]</code>. Un <code>/</code> final = dossier, sinon fichier (son dossier parent est créé au besoin).
          Le <code>R</code> applique le droit <strong>récursivement</strong> au contenu. Ex. <code>2770</code> = rwx pour le groupe + <strong>SGID</strong> (les fichiers créés héritent du groupe du dossier — idéal pour un partage d’équipe).
          {lA.length ? <> {lA.filter(n => n.dir).length} dossier(s), {lA.filter(n => !n.dir).length} fichier(s).</> : null}
        </div>
      </div>

      {soucis.length > 0 && (
        <aside className="pb-note pb-note-red" style={{ marginBottom: 14 }}>
          <p className="pb-note-title">🚫 À vérifier avant de copier</p>
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
                <button type="button" onClick={() => copier('console-' + sec.id, pourConsoleUsers(sec))} style={{ ...bouton, background: copie === 'console-' + sec.id ? 'var(--accent)' : 'transparent', color: copie === 'console-' + sec.id ? '#fff' : 'var(--accent)' }} title="Version qui s’enregistre dans ~/ et se lance : à coller telle quelle dans le terminal">
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
        Les scripts sont <strong>rejouables</strong> : un groupe ou un utilisateur déjà présent n’est pas recréé, seuls les groupes et droits sont réappliqués. Lance <code>① comptes</code> puis <code>② arborescence</code> en root. Pour livrer le fichier des droits d’une éval : <code>cd /home &amp;&amp; sudo ls -lR &gt; droits.txt</code>.
      </div>
    </div>
  );
}

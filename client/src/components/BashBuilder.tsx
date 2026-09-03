/**
 * Constructeur de script Bash — îlot React (data-block="bash-builder").
 *
 * Un script d'administration n'est pas difficile à écrire : il est difficile à
 * écrire *sûrement*. Les fautes qui coûtent cher sont toujours les mêmes — une
 * variable vide dans un `rm -rf`, une erreur au milieu qui n'arrête rien, un
 * fichier temporaire laissé derrière, deux exécutions simultanées.
 *
 * L'outil assemble donc un squelette qui les évite, et **dit pourquoi** chaque
 * ligne est là. Le script produit est complet et exécutable : on remplace le
 * corps, le reste tient debout.
 */
import { useMemo, useState } from 'react';
import { BRIQUES, fabriquer, type Cle } from '@/lib/bash-script';

const champ: React.CSSProperties = { padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 13.5, boxSizing: 'border-box' };
const mono: React.CSSProperties = { fontFamily: "ui-monospace,'Space Mono',SFMono-Regular,Menlo,Consolas,monospace" };
const groupe: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', background: 'var(--surface-2)', marginBottom: 14 };
const legende: React.CSSProperties = { fontWeight: 700, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const petit: React.CSSProperties = { padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'transparent', color: 'var(--text-soft)', fontWeight: 600, cursor: 'pointer', fontSize: 12 };

/*
 * @id     tssr.atelier.bashBuilder
 * @do     construire_script_bash
 * @role   ui
 * @layer  ui
 * @human  Atelier : constructeur de scripts bash guidé.
 */
export function BashBuilder() {
  const [nom, setNom] = useState('sauvegarde.sh');
  const [desc, setDesc] = useState('Sauvegarde les données métier vers le volume de secours');
  const [cmds, setCmds] = useState('rsync -aAX --delete "$SOURCE" "$DESTINATION"');
  const [on, setOn] = useState<Record<Cle, boolean>>(
    () => Object.fromEntries(BRIQUES.map(b => [b.cle, b.defaut])) as Record<Cle, boolean>,
  );
  const [copie, setCopie] = useState(false);
  const [detail, setDetail] = useState<Cle | null>(null);

  const script = useMemo(() => fabriquer(nom, desc, cmds, on), [nom, desc, cmds, on]);

  const telecharger = () => {
    const url = URL.createObjectURL(new Blob([script], { type: 'text/x-shellscript' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nom.replace(/[^A-Za-z0-9._-]/g, '') || 'script.sh';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="outil-large">
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>🧱 Constructeur de script Bash</div>
        <span className="meta" style={{ fontSize: 11.5 }}>
          Le squelette est la partie difficile — pas le traitement.
        </span>
      </div>

      <div style={groupe}>
        <div style={legende}>📝 Ce que fait le script</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
          <label style={{ fontSize: 12 }}>Nom du fichier<br />
            <input style={{ ...champ, width: '100%', ...mono }} value={nom} onChange={e => setNom(e.target.value)} />
          </label>
          <label style={{ fontSize: 12, gridColumn: 'span 2' }}>Description (une ligne, elle sert d’aide)<br />
            <input style={{ ...champ, width: '100%' }} value={desc} onChange={e => setDesc(e.target.value)} />
          </label>
        </div>
        <label style={{ fontSize: 12, display: 'block', marginTop: 10 }}>Le traitement — une commande par ligne<br />
          <textarea value={cmds} onChange={e => setCmds(e.target.value)} rows={4}
            style={{ ...champ, ...mono, width: '100%', resize: 'vertical', fontSize: 12.5 }} />
        </label>
        <div className="meta" style={{ fontSize: 11.5, marginTop: 5 }}>
          Les variables <code>$SOURCE</code> et <code>$DESTINATION</code> viennent des arguments ; <code>$TEMPO</code> est
          un dossier temporaire nettoyé automatiquement.
        </div>
      </div>

      <div style={groupe}>
        <div style={legende}>
          🛡️ Les garde-fous
          <span className="meta" style={{ fontSize: 11.5, fontWeight: 400 }}>
            clique un titre pour savoir ce qu’il évite
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 6 }}>
          {BRIQUES.map(b => (
            <div key={b.cle}>
              <label style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 12.5, cursor: 'pointer', padding: '4px 0' }}>
                <input type="checkbox" checked={on[b.cle]} style={{ marginTop: 2 }}
                  onChange={e => setOn({ ...on, [b.cle]: e.target.checked })} />
                <span
                  role="button"
                  tabIndex={0}
                  onClick={ev => { ev.preventDefault(); setDetail(detail === b.cle ? null : b.cle); }}
                  onKeyDown={ev => { if (ev.key === 'Enter') { ev.preventDefault(); setDetail(detail === b.cle ? null : b.cle); } }}
                  style={{ borderBottom: '1px dotted var(--text-muted)' }}>
                  {b.titre}
                </span>
              </label>
              {detail === b.cle && (
                <div style={{ fontSize: 11.5, color: 'var(--text-soft)', margin: '0 0 8px 24px', paddingLeft: 8, borderLeft: '2px solid var(--accent)' }}>
                  {b.pourquoi}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={groupe}>
        <div style={legende}>
          📜 Le script
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" style={petit} onClick={telecharger}>💾 .sh</button>
            <button type="button" style={{ ...petit, borderColor: copie ? 'var(--accent)' : 'var(--border)', color: copie ? 'var(--accent)' : 'var(--text-soft)' }}
              onClick={() => {
                navigator.clipboard?.writeText(script).then(() => {
                  setCopie(true);
                  setTimeout(() => setCopie(false), 1500);
                }).catch(() => { /* presse-papiers refusé : le texte reste sélectionnable */ });
              }}>
              {copie ? '✓ Copié' : 'Copier'}
            </button>
          </div>
        </div>
        <pre style={{ ...mono, background: 'var(--surface-3)', border: '1px solid var(--border)', borderLeft: '3px solid var(--accent)', borderRadius: 8, padding: '12px 14px', overflowX: 'auto', fontSize: 12, lineHeight: 1.55, margin: 0, whiteSpace: 'pre' }}>
          <code>{script}</code>
        </pre>
        <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>
          Ensuite : <code>chmod +x {nom.replace(/[^A-Za-z0-9._-]/g, '') || 'script.sh'}</code>, puis
          <code> shellcheck {nom.replace(/[^A-Za-z0-9._-]/g, '') || 'script.sh'}</code> — il attrape les fautes de
          citation qu’aucune relecture ne voit.
        </div>
      </div>
    </div>
  );
}

/**
 * Notion : installer et sécuriser SSH sous Linux (OpenSSH sur Debian) —
 * îlot React (data-block="ssh-linux").
 *
 * Un guide de mise en service, dans l'ordre : installer, vérifier l'écoute, se
 * connecter, passer à la clé, durcir, ouvrir le pare-feu. Chaque étape se
 * déplie, avec ses commandes copiables et le piège qui coupe la session. C'est
 * un cours : il n'exécute rien, il montre l'ordre juste et pourquoi il l'est.
 */
import { useState } from 'react';
import {
  SSH_EXEMPLE, SSH_ETAPES, SSH_OPTIONS, SSH_SSHD_CONFIG, SSH_TEST_CLIENT,
} from '@/lib/ssh-linux';

const mono: React.CSSProperties = { fontFamily: "ui-monospace,'Space Mono',SFMono-Regular,Menlo,Consolas,monospace" };
const groupe: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', background: 'var(--surface-2)', marginBottom: 14 };
const legende: React.CSSProperties = { fontWeight: 700, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const petit: React.CSSProperties = { padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'transparent', color: 'var(--text-soft)', fontWeight: 600, cursor: 'pointer', fontSize: 12 };
const pre: React.CSSProperties = { ...mono, background: 'var(--surface-3)', border: '1px solid var(--border)', borderLeft: '3px solid var(--accent)', borderRadius: 8, padding: '11px 13px', overflowX: 'auto', fontSize: 12, lineHeight: 1.55, margin: 0, whiteSpace: 'pre' };

/*
 * @id     tssr.atelier.sshLinuxComp
 * @do     presenter_installation_ssh_linux
 * @role   ui
 * @layer  ui
 * @human  Atelier : installer et sécuriser SSH sous Linux (OpenSSH sur Debian).
 */
export function SshLinux() {
  // La première étape est ouverte : on montre par où commencer sans tout dérouler.
  const [ouvert, setOuvert] = useState<number | null>(0);
  const [copie, setCopie] = useState('');

  const copier = (texte: string, id: string) => {
    navigator.clipboard?.writeText(texte).then(() => {
      setCopie(id);
      setTimeout(() => setCopie(''), 1400);
    }).catch(() => { /* presse-papiers refusé : le texte reste sélectionnable */ });
  };

  const boutonCopier = (texte: string, id: string) => (
    <button type="button" style={{ ...petit, marginLeft: 'auto', borderColor: copie === id ? 'var(--accent)' : 'var(--border)', color: copie === id ? 'var(--accent)' : 'var(--text-soft)' }}
      onClick={() => copier(texte, id)}>{copie === id ? '✓ Copié' : 'Copier'}</button>
  );

  return (
    <div className="outil-large">
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 4 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>🔐 Installer SSH sous Linux — OpenSSH sur Debian</div>
        <span className="meta" style={{ fontSize: 11.5 }}>On ne durcit un accès qu’une fois sûr d’y entrer autrement.</span>
      </div>

      {/* Le fil rouge : un exemple unique. */}
      <div style={{ ...groupe, borderLeft: '3px solid var(--accent)' }}>
        <div style={legende}>🧵 L’exemple du fil rouge</div>
        <div className="meta" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
          Serveur <code style={mono}>{SSH_EXEMPLE.serveurNom}</code> en{' '}
          <code style={mono}>{SSH_EXEMPLE.serveurIp}</code>, administrateur{' '}
          <code style={mono}>{SSH_EXEMPLE.admin}</code>, port{' '}
          <code style={mono}>{SSH_EXEMPLE.port}</code>. Le client SSH est natif sous Windows comme sous Linux.
        </div>
      </div>

      {/* Les étapes de la mise en service. */}
      <div style={groupe}>
        <div style={legende}>🪜 La mise en service, étape par étape</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SSH_ETAPES.map((e, i) => {
            const actif = ouvert === i;
            return (
              <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', overflow: 'hidden' }}>
                <button type="button" onClick={() => setOuvert(actif ? null : i)}
                  style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--text)', display: 'flex', gap: 10, alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5, flex: 1 }}>{e.titre}</span>
                  {e.root && <span className="meta" style={{ ...mono, fontSize: 10.5, border: '1px solid var(--border)', borderRadius: 6, padding: '1px 6px' }}>root</span>}
                  <span className="meta" style={{ fontSize: 14 }}>{actif ? '▾' : '▸'}</span>
                </button>
                {actif && (
                  <div style={{ padding: '2px 14px 14px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 12.5, color: 'var(--text-soft)', margin: '10px 0 8px', fontStyle: 'italic' }}>{e.but}</div>
                    <div style={{ display: 'flex', marginBottom: 6 }}>{boutonCopier(e.commandes, 'e' + i)}</div>
                    <pre style={pre}><code>{e.commandes}</code></pre>
                    <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-soft)' }}>
                      {e.details.map((d, k) => <li key={k} style={{ marginBottom: 4 }}>{d}</li>)}
                    </ul>
                    {e.piege && (
                      <div style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.55, color: 'var(--text)', background: 'color-mix(in srgb, #d97706 14%, transparent)', border: '1px solid color-mix(in srgb, #d97706 45%, var(--border))', borderRadius: 8, padding: '8px 11px' }}>
                        <strong>⚠ Piège —</strong> {e.piege}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Les directives de sshd_config qui comptent. */}
      <div style={groupe}>
        <div style={legende}>🎚️ Les directives de <code style={mono}>sshd_config</code> qui comptent</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>Directive</th>
                <th style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>Conseillé</th>
                <th style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>Rôle</th>
              </tr>
            </thead>
            <tbody>
              {SSH_OPTIONS.map(o => (
                <tr key={o.cle}>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', ...mono, fontWeight: 700, color: 'var(--accent)', whiteSpace: 'nowrap' }}>{o.cle}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', ...mono, whiteSpace: 'nowrap' }}>{o.valeur}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', color: 'var(--text-soft)', lineHeight: 1.5 }}>{o.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Le fichier durci, entier. */}
      <div style={groupe}>
        <div style={legende}>
          📄 <code style={mono}>/etc/ssh/sshd_config</code> — extrait durci
          {boutonCopier(SSH_SSHD_CONFIG, 'sshd')}
        </div>
        <pre style={pre}><code>{SSH_SSHD_CONFIG}</code></pre>
        <div className="meta" style={{ fontSize: 11.5, marginTop: 8, lineHeight: 1.6 }}>
          Toujours <code style={mono}>sshd -t</code> avant <code style={mono}>systemctl restart ssh</code>, et garder une session ouverte le temps de tester la nouvelle config.
        </div>
      </div>

      {/* Le test depuis un client. */}
      <div style={groupe}>
        <div style={legende}>
          🖥️ Tester depuis un poste client
          {boutonCopier(SSH_TEST_CLIENT, 'test')}
        </div>
        <pre style={pre}><code>{SSH_TEST_CLIENT}</code></pre>
      </div>
    </div>
  );
}

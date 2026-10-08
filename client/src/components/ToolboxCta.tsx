import { useState } from 'react';

/**
 * Îlot « Boîte à outils Debian » : trois boutons d'action (copier la commande
 * d'installation, de lancement, ou les deux) + un bloc de code DÉROULABLE qui
 * charge à la demande le script complet depuis /tssr-toolbox.sh.
 * Hydraté via RichContent (data-block="toolbox-cta").
 */

const URL = 'https://tssr.miyukini.com/tssr-toolbox.sh';

// Les trois commandes proposées à la copie.
const CMD_INSTALL = `curl -fsSL ${URL} -o tssr-toolbox.sh && chmod +x tssr-toolbox.sh`;
const CMD_LANCER = `sudo bash <(curl -fsSL ${URL})`;
const CMD_DEUX = `curl -fsSL ${URL} -o tssr-toolbox.sh && chmod +x tssr-toolbox.sh && sudo ./tssr-toolbox.sh`;

export function ToolboxCta() {
  const [copie, setCopie] = useState<string>('');        // id du bouton venant d'être copié
  const [code, setCode] = useState<string>('');          // contenu du script (chargé à la demande)
  const [etat, setEtat] = useState<'vide' | 'charge' | 'ok' | 'ko'>('vide');

  async function copier(id: string, texte: string) {
    try {
      await navigator.clipboard.writeText(texte);
    } catch {
      // Repli : sélection via un textarea temporaire.
      const t = document.createElement('textarea');
      t.value = texte; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); } catch { /* tant pis */ }
      document.body.removeChild(t);
    }
    setCopie(id);
    window.setTimeout(() => setCopie((c) => (c === id ? '' : c)), 1800);
  }

  // Charge le script la 1re fois qu'on déplie le bloc de code.
  async function chargerCode(ouvert: boolean) {
    if (!ouvert || etat === 'charge' || etat === 'ok') return;
    setEtat('charge');
    try {
      const r = await fetch('/tssr-toolbox.sh', { cache: 'no-store' });
      if (!r.ok) throw new Error(String(r.status));
      setCode(await r.text());
      setEtat('ok');
    } catch {
      setEtat('ko');
    }
  }

  const boutonBase: React.CSSProperties = {
    appearance: 'none', cursor: 'pointer', border: '1px solid var(--border)',
    borderRadius: 10, padding: '11px 16px', fontSize: 14, fontWeight: 600,
    fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8,
  };
  const primaire: React.CSSProperties = {
    ...boutonBase, background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)',
  };
  const secondaire: React.CSSProperties = {
    ...boutonBase, background: 'var(--surface-2)', color: 'var(--text)',
  };

  return (
    <div style={{ margin: '14px 0' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <button type="button" style={secondaire} onClick={() => copier('install', CMD_INSTALL)}>
          {copie === 'install' ? '✓ Copié' : '⬇️ Copier l’installation'}
        </button>
        <button type="button" style={secondaire} onClick={() => copier('lancer', CMD_LANCER)}>
          {copie === 'lancer' ? '✓ Copié' : '▶️ Copier le lancement'}
        </button>
        <button type="button" style={primaire} onClick={() => copier('deux', CMD_DEUX)}>
          {copie === 'deux' ? '✓ Copié' : '⚡ Copier (installer + lancer)'}
        </button>
      </div>

      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '8px 2px 0' }}>
        Colle la commande dans le terminal de ta VM Debian. « Installer » télécharge le script ;
        « Lancement » l’exécute à la volée (sans fichier) ; « les deux » télécharge puis lance.
      </p>

      <details style={{ marginTop: 14, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-2)' }}
               onToggle={(e) => chargerCode((e.target as HTMLDetailsElement).open)}>
        <summary style={{ cursor: 'pointer', padding: '11px 14px', fontWeight: 600, fontSize: 14 }}>
          📜 Voir tout le code du script
        </summary>
        <div style={{ padding: '0 14px 14px' }}>
          {etat === 'charge' && <p style={{ color: 'var(--text-muted)' }}>Chargement…</p>}
          {etat === 'ko' && (
            <p style={{ color: 'var(--text-muted)' }}>
              Lecture impossible ici — récupère-le directement :{' '}
              <a href={URL}>{URL}</a>
            </p>
          )}
          {etat === 'ok' && (
            <>
              <div style={{ margin: '0 0 8px' }}>
                <button type="button" style={{ ...boutonBase, padding: '5px 11px', fontSize: 12.5 }}
                        onClick={() => copier('code', code)}>
                  {copie === 'code' ? '✓ Copié' : 'Copier tout le script'}
                </button>
              </div>
              <pre style={{
                margin: 0, maxHeight: 460, overflow: 'auto', background: 'var(--surface-3)',
                border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px',
                fontSize: 12, lineHeight: 1.55,
              }}>
                <code style={{ fontFamily: 'ui-monospace,Consolas,monospace', whiteSpace: 'pre' }}>{code}</code>
              </pre>
            </>
          )}
        </div>
      </details>
    </div>
  );
}

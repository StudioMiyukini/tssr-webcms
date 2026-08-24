/**
 * Aide-mémoire Linux cherchable — îlot React (data-block="linux-commandes").
 *
 * L'inventaire des GPO règle un problème de localisation : on connaît le nom du
 * paramètre, jamais son emplacement. Ici c'est l'inverse — on sait exactement ce
 * qu'on veut faire et on ignore le nom de la commande. La recherche porte donc
 * d'abord sur la **tâche**, écrite comme on la formule, puis sur les alias, qui
 * couvrent les commandes obsolètes qu'on tape par habitude (`ifconfig`) et les
 * noms Windows, parce qu'un TSSR arrive presque toujours de ce côté-là.
 */
import { useMemo, useState } from 'react';
import { LINUX_CATEGORIES, LINUX_ENTRIES, type LinuxEntry } from '@/lib/linux-data';
import { rechercher, termes } from '@/lib/linux-recherche';

/** Minuscules sans accents : « répertoire » se trouve en tapant « repertoire ». */
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Surligne les mots retenus de la requête.
 *
 * La version précédente cherchait la requête ENTIÈRE dans le texte : dès qu'on
 * écrivait une phrase, plus rien n'était surligné — alors que c'est justement
 * la phrase que la recherche sait maintenant traiter.
 */
const surligne = (texte: string, mots: string[]) => {
  if (!mots.length) return texte;
  const n = norm(texte);
  const zones: Array<[number, number]> = [];
  for (const m of mots) {
    let i = n.indexOf(m);
    while (i !== -1) {
      zones.push([i, i + m.length]);
      i = n.indexOf(m, i + m.length);
    }
  }
  if (!zones.length) return texte;
  zones.sort((a, b) => a[0] - b[0]);
  const out: React.ReactNode[] = [];
  let pos = 0;
  for (const [d, f] of zones) {
    if (d < pos) continue;              // chevauchement : on garde le premier
    if (d > pos) out.push(texte.slice(pos, d));
    out.push(<mark key={d} style={{ background: 'color-mix(in srgb, var(--accent) 32%, transparent)', color: 'inherit', padding: '0 1px', borderRadius: 2 }}>{texte.slice(d, f)}</mark>);
    pos = f;
  }
  if (pos < texte.length) out.push(texte.slice(pos));
  return <>{out}</>;
};

const champ: React.CSSProperties = { width: '100%', padding: '9px 11px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--surface)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' };
const puce: React.CSSProperties = { padding: '3px 10px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 600, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-soft)' };
const mono: React.CSSProperties = { fontFamily: "ui-monospace,'Space Mono',SFMono-Regular,Menlo,Consolas,monospace" };
const bloc: React.CSSProperties = { ...mono, background: 'var(--surface-3)', border: '1px solid var(--border)', borderLeft: '3px solid var(--accent)', borderRadius: 8, padding: '9px 11px', fontSize: 12.5, whiteSpace: 'pre-wrap', overflowX: 'auto', lineHeight: 1.55, margin: '6px 0 0' };

export function LinuxCommandes() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [copie, setCopie] = useState('');

  const requete = q.trim();

  const resultats = useMemo(() => rechercher(LINUX_ENTRIES, requete, cat), [requete, cat]);
  // Ce que la recherche a réellement retenu de la phrase : sans cet affichage,
  // un résultat surprenant reste inexplicable pour celui qui a tapé.
  const motsRetenus = useMemo(() => termes(requete).map(t => t.mot), [requete]);

  const copier = (texte: string, id: string) => {
    navigator.clipboard?.writeText(texte).then(() => {
      setCopie(id);
      setTimeout(() => setCopie(''), 1400);
    }).catch(() => { /* presse-papiers refusé : la commande reste sélectionnable */ });
  };

  const catDe = (k: string) => LINUX_CATEGORIES.find(c => c.key === k);

  return (
    <div className="outil-large">
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>🐧 Que veux-tu faire ?</div>
        <span className="meta" style={{ fontSize: 11.5 }}>
          {resultats.length} / {LINUX_ENTRIES.length} commandes
        </span>
      </div>

      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Écris ta question : comment voir la place qui reste sur le disque ?"
        style={{ ...champ, marginBottom: 8 }}
        aria-label="Rechercher une commande par ce qu’elle fait"
      />
      <div className="meta" style={{ fontSize: 11.5, marginBottom: 10 }}>
        Pose ta question en français — <strong>ce que tu veux faire</strong>, pas le nom de la commande. Les mots
        inutiles sont ignorés, les synonymes reconnus (<em>place</em> = <em>espace</em> = <em>disque</em>), et les
        anciens noms (<code>ifconfig</code>, <code>netstat</code>) comme les équivalents Windows (<code>ipconfig</code>,{' '}
        <code>findstr</code>) mènent au bon endroit.
      </div>

      {motsRetenus.length > 0 && (
        <div className="meta" style={{ fontSize: 11, marginBottom: 10, display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>Recherche sur&nbsp;:</span>
          {motsRetenus.map(m => (
            <code key={m} style={{ fontSize: 10.5, padding: '1px 7px', borderRadius: 999, border: '1px solid var(--border)' }}>{m}</code>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        <button type="button" onClick={() => setCat('all')}
          style={{ ...puce, borderColor: cat === 'all' ? 'var(--accent)' : 'var(--border)', color: cat === 'all' ? 'var(--accent)' : 'var(--text-soft)' }}>
          Tout
        </button>
        {LINUX_CATEGORIES.map(c => (
          <button key={c.key} type="button" onClick={() => setCat(cat === c.key ? 'all' : c.key)}
            style={{ ...puce, borderColor: cat === c.key ? 'var(--accent)' : 'var(--border)', color: cat === c.key ? 'var(--accent)' : 'var(--text-soft)' }}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {!resultats.length && (
        <div className="meta" style={{ fontSize: 13, padding: '20px 0' }}>
          Rien pour « {requete} ». Essaie avec d’autres mots : <em>place</em>, <em>port</em>, <em>droits</em>,{' '}
          <em>service</em>, <em>log</em>, <em>copier</em>.
        </div>
      )}

      {resultats.map(e => {
        const c = catDe(e.categorie);
        const estOuvert = ouvert === e.tache;
        const aDuDetail = !!(e.options?.length || e.aussi?.length || e.piege || e.windows);
        return (
          <div key={e.tache} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 13px', marginBottom: 9, background: 'var(--surface)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13 }}>{c?.icon}</span>
              <strong style={{ fontSize: 13.5 }}>{surligne(e.tache, motsRetenus)}</strong>
              {e.root && <span title="Demande les droits root" style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 7px', borderRadius: 999, color: '#d97706', border: '1px solid #d97706' }}>root</span>}
              <button type="button" onClick={() => copier(e.commande, e.tache)}
                style={{ ...puce, marginLeft: 'auto', borderColor: copie === e.tache ? 'var(--accent)' : 'var(--border)', color: copie === e.tache ? 'var(--accent)' : 'var(--text-soft)' }}>
                {copie === e.tache ? '✓ copiée' : 'Copier'}
              </button>
            </div>

            <pre style={bloc}><code>{e.commande}</code></pre>
            <div style={{ fontSize: 12.5, marginTop: 6, color: 'var(--text-soft)' }}>{surligne(e.quoi, motsRetenus)}</div>

            {aDuDetail && (
              <button type="button" onClick={() => setOuvert(estOuvert ? null : e.tache)}
                style={{ ...puce, marginTop: 8, borderStyle: 'dashed' }}>
                {estOuvert ? '− Replier' : '+ Options, pièges et équivalent Windows'}
              </button>
            )}

            {estOuvert && (
              <div style={{ marginTop: 9, paddingLeft: 10, borderLeft: '2px solid var(--border)' }}>
                {!!e.options?.length && (
                  <table style={{ borderCollapse: 'collapse', fontSize: 12, margin: '0 0 8px' }}>
                    <tbody>
                      {e.options.map(([o, d]) => (
                        <tr key={o}>
                          <td style={{ ...mono, padding: '2px 12px 2px 0', whiteSpace: 'nowrap', color: 'var(--accent)' }}>{o}</td>
                          <td style={{ padding: '2px 0', color: 'var(--text-soft)' }}>{d}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {!!e.aussi?.length && (
                  <>
                    <div className="meta" style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 3 }}>Aussi</div>
                    <pre style={{ ...bloc, borderLeftColor: 'var(--border)', margin: '0 0 8px' }}><code>{e.aussi.join('\n')}</code></pre>
                  </>
                )}

                {e.piege && (
                  <div style={{ fontSize: 12, marginBottom: 8, padding: '7px 9px', borderRadius: 8, border: '1px solid #d97706', background: 'color-mix(in srgb,#d97706 8%,transparent)' }}>
                    <strong>⚠ Le piège — </strong>{e.piege}
                  </div>
                )}

                {e.windows && (
                  <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                    🪟 Côté Windows : <code style={mono}>{e.windows}</code>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

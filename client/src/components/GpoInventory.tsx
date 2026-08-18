/**
 * Inventaire des GPO — îlot React hydraté via RichContent (data-block="gpo-inventory").
 *
 * Le problème qu'il règle n'est pas de savoir QUE le paramètre existe : c'est de
 * le retrouver dans une arborescence à six niveaux. La recherche porte donc sur
 * le nom français, le nom anglais, l'effet, le chemin ET des alias — parce que
 * personne ne tape « Accès au stockage amovible », on tape « USB ».
 */
import { useMemo, useState } from 'react';
import { GPO_CATEGORIES, GPO_ENTRIES, gpoChemin, type GpoEntry } from '@/lib/gpo-data';

/** Minuscules sans accents : « Périphérique » se trouve en tapant « peripherique ». */
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const surligne = (texte: string, q: string) => {
  if (!q) return texte;
  const i = norm(texte).indexOf(norm(q));
  if (i === -1) return texte;
  return (
    <>
      {texte.slice(0, i)}
      <mark style={{ background: 'color-mix(in srgb, var(--accent) 30%, transparent)', color: 'inherit', padding: '0 1px', borderRadius: 2 }}>{texte.slice(i, i + q.length)}</mark>
      {texte.slice(i + q.length)}
    </>
  );
};

export function GpoInventory() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [scope, setScope] = useState<'all' | 'ordinateur' | 'utilisateur'>('all');
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [copie, setCopie] = useState('');

  const requete = q.trim();

  const resultats = useMemo(() => {
    const nq = norm(requete);
    return GPO_ENTRIES.filter((e) => {
      if (cat !== 'all' && e.categorie !== cat) return false;
      if (scope !== 'all' && e.scope !== scope) return false;
      if (!nq) return true;
      const foin = norm([e.nom, e.nomEn, e.effet, e.valeurs ?? '', e.piege ?? '', gpoChemin(e), (e.alias ?? []).join(' ')].join(' '));
      return foin.includes(nq);
    });
  }, [requete, cat, scope]);

  const parCategorie = GPO_CATEGORIES
    .map((c) => ({ ...c, items: resultats.filter((e) => e.categorie === c.key) }))
    .filter((g) => g.items.length > 0);

  const copier = (e: GpoEntry) => {
    const texte = `${e.nom}\n${gpoChemin(e)}`;
    navigator.clipboard?.writeText(texte).then(() => {
      setCopie(e.nom);
      setTimeout(() => setCopie(''), 1600);
    }).catch(() => { /* presse-papiers indisponible */ });
  };

  const champ: React.CSSProperties = {
    padding: '8px 12px', fontSize: 14, borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--surface)', color: 'inherit',
  };
  const puce = (actif: boolean): React.CSSProperties => ({
    padding: '4px 11px', fontSize: 12.5, borderRadius: 999, cursor: 'pointer', font: 'inherit',
    border: `1px solid ${actif ? 'var(--accent)' : 'var(--border)'}`,
    background: actif ? 'var(--accent)' : 'var(--surface)',
    color: actif ? '#fff' : 'inherit',
  });

  return (
    <div style={{ margin: '14px 0' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Chercher : USB, lecteur réseau, RDP, mot de passe, loopback…"
          aria-label="Rechercher un paramètre de stratégie de groupe"
          style={{ ...champ, flex: '1 1 320px', minWidth: 0 }}
        />
        <span style={{ fontSize: 12.5, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {resultats.length} / {GPO_ENTRIES.length}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
        <button type="button" style={puce(scope === 'all')} onClick={() => setScope('all')}>Les deux</button>
        <button type="button" style={puce(scope === 'ordinateur')} onClick={() => setScope('ordinateur')}>💻 Ordinateur</button>
        <button type="button" style={puce(scope === 'utilisateur')} onClick={() => setScope('utilisateur')}>👤 Utilisateur</button>
      </div>

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 14 }}>
        <button type="button" style={puce(cat === 'all')} onClick={() => setCat('all')}>Toutes</button>
        {GPO_CATEGORIES.map((c) => (
          <button key={c.key} type="button" style={puce(cat === c.key)} onClick={() => setCat(c.key)}>{c.icon} {c.label}</button>
        ))}
      </div>

      {resultats.length === 0 && (
        <p className="meta" style={{ fontSize: 13 }}>
          Rien pour « {requete} ». Cet inventaire retient les paramètres que l’on pose réellement, pas les
          quatre mille existants — si celui que vous cherchez manque, la section <strong>« Retrouver un paramètre
          qui n’est pas ici »</strong> plus bas explique comment le débusquer dans la console.
        </p>
      )}

      {parCategorie.map((g) => (
        <div key={g.key} style={{ marginBottom: 18 }}>
          <h4 style={{ fontSize: 14, margin: '0 0 8px' }}>{g.icon} {g.label} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({g.items.length})</span></h4>
          {g.items.map((e) => {
            const actif = ouvert === e.nom;
            return (
              <div key={e.nom} style={{ border: '1px solid var(--border)', borderRadius: 9, marginBottom: 6, background: 'var(--surface)' }}>
                <button
                  type="button"
                  onClick={() => setOuvert(actif ? null : e.nom)}
                  aria-expanded={actif}
                  style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', font: 'inherit', padding: '9px 12px', display: 'flex', gap: 9, alignItems: 'baseline', flexWrap: 'wrap', color: 'inherit' }}
                >
                  <span style={{ fontSize: 11, opacity: 0.8 }}>{e.scope === 'ordinateur' ? '💻' : '👤'}</span>
                  <strong style={{ fontSize: 13.5 }}>{surligne(e.nom, requete)}</strong>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontStyle: 'italic' }}>{surligne(e.nomEn, requete)}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>{actif ? '▲' : '▼'}</span>
                </button>

                {actif && (
                  <div style={{ padding: '0 12px 12px', fontSize: 13 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      <code style={{ fontSize: 11.5, padding: '5px 8px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, flex: '1 1 auto', minWidth: 0, wordBreak: 'break-word' }}>
                        {gpoChemin(e)}
                      </code>
                      <button
                        type="button"
                        onClick={() => copier(e)}
                        style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'inherit', cursor: 'pointer', font: 'inherit', whiteSpace: 'nowrap' }}
                      >
                        {copie === e.nom ? '✓ Copié' : 'Copier le chemin'}
                      </button>
                    </div>
                    <p style={{ margin: '0 0 6px' }}>{e.effet}</p>
                    {e.valeurs && <p style={{ margin: '0 0 6px' }}><strong>Valeur :</strong> {e.valeurs}</p>}
                    {e.piege && (
                      <p style={{ margin: '6px 0 0', padding: '8px 10px', borderRadius: 7, background: 'color-mix(in srgb, #e0a800 12%, transparent)', border: '1px solid color-mix(in srgb, #e0a800 35%, transparent)' }}>
                        <strong>⚠️ Le piège :</strong> {e.piege}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

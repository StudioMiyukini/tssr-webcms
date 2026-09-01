/**
 * Notions : le DNS sous Linux (BIND9 sur Debian) — îlot React (data-block="dns-linux").
 *
 * La fiche de recherche pose huit questions ; ce bloc y répond dans l'ordre, en
 * s'appuyant sur un exemple unique (miyukini.lan, servi par srv-dns en
 * 192.168.10.11). Chaque notion se déplie ; les fichiers de zone sont donnés
 * entiers, prêts à copier et à adapter. C'est un cours, pas un configurateur :
 * il n'écrit rien, il montre ce qu'il faut savoir monter, vérifier et tester.
 */
import { useState } from 'react';
import {
  DNS_EXEMPLE, DNS_NOTIONS, DNS_ENREGISTREMENTS, DNS_FICHIERS_EXEMPLE,
} from '@/lib/dns-linux';

const mono: React.CSSProperties = { fontFamily: "ui-monospace,'Space Mono',SFMono-Regular,Menlo,Consolas,monospace" };
const groupe: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', background: 'var(--surface-2)', marginBottom: 14 };
const legende: React.CSSProperties = { fontWeight: 700, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const petit: React.CSSProperties = { padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'transparent', color: 'var(--text-soft)', fontWeight: 600, cursor: 'pointer', fontSize: 12 };
const pre: React.CSSProperties = { ...mono, background: 'var(--surface-3)', border: '1px solid var(--border)', borderLeft: '3px solid var(--accent)', borderRadius: 8, padding: '11px 13px', overflowX: 'auto', fontSize: 12, lineHeight: 1.55, margin: 0, whiteSpace: 'pre' };

/*
 * @id     tssr.atelier.dnsLinuxComp
 * @do     presenter_notions_dns_linux
 * @role   ui
 * @layer  ui
 * @human  Atelier : les notions du DNS sous Linux (BIND9 sur Debian).
 */
export function DnsLinux() {
  // La première notion est ouverte d'emblée : une page toute fermée n'invite pas
  // à lire, une page toute ouverte n'aide pas à s'y retrouver.
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
        <div style={{ fontWeight: 700, fontSize: 15 }}>🌐 Le DNS sous Linux — BIND9 sur Debian</div>
        <span className="meta" style={{ fontSize: 11.5 }}>Résoudre un nom, et savoir pourquoi quand ça ne résout pas.</span>
      </div>

      {/* Le fil rouge : un exemple unique, réutilisé dans chaque fichier. */}
      <div style={{ ...groupe, borderLeft: '3px solid var(--accent)' }}>
        <div style={legende}>🧵 L’exemple du fil rouge</div>
        <div className="meta" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
          Domaine <code style={mono}>{DNS_EXEMPLE.domaine}</code>, servi par{' '}
          <code style={mono}>{DNS_EXEMPLE.serveurNom}</code> en{' '}
          <code style={mono}>{DNS_EXEMPLE.serveurIp}</code>. Réseau{' '}
          <code style={mono}>{DNS_EXEMPLE.reseau}/{DNS_EXEMPLE.cidr}</code>, donc zone inverse{' '}
          <code style={mono}>{DNS_EXEMPLE.zoneInverse}</code> (les trois premiers octets, à l’envers).
        </div>
      </div>

      {/* Les huit notions, chacune dépliable. */}
      <div style={groupe}>
        <div style={legende}>📚 Les notions — les 8 questions de la fiche</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {DNS_NOTIONS.map((n, i) => {
            const actif = ouvert === i;
            return (
              <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', overflow: 'hidden' }}>
                <button type="button" onClick={() => setOuvert(actif ? null : i)}
                  style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--text)', display: 'flex', gap: 10, alignItems: 'baseline' }}>
                  <span style={{ ...mono, color: 'var(--accent)', fontWeight: 700, fontSize: 12.5 }}>{i + 1}</span>
                  <span style={{ fontWeight: 600, fontSize: 13.5, flex: 1 }}>{n.question}</span>
                  <span className="meta" style={{ fontSize: 14 }}>{actif ? '▾' : '▸'}</span>
                </button>
                {actif && (
                  <div style={{ padding: '2px 14px 14px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', margin: '10px 0 8px' }}>→ {n.reponse}</div>
                    <ul style={{ margin: '0 0 10px', paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-soft)' }}>
                      {n.details.map((d, k) => <li key={k} style={{ marginBottom: 4 }}>{d}</li>)}
                    </ul>
                    {n.code && (
                      <div>
                        <div style={{ display: 'flex', marginBottom: 6 }}>{boutonCopier(n.code, 'n' + i)}</div>
                        <pre style={pre}><code>{n.code}</code></pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Le tableau des enregistrements. */}
      <div style={groupe}>
        <div style={legende}>🏷️ Les enregistrements d’une zone</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>Type</th>
                <th style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>Nom</th>
                <th style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>Rôle</th>
                <th style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>Exemple</th>
              </tr>
            </thead>
            <tbody>
              {DNS_ENREGISTREMENTS.map(e => (
                <tr key={e.type}>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', ...mono, fontWeight: 700, color: 'var(--accent)', whiteSpace: 'nowrap' }}>{e.type}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{e.nom}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', color: 'var(--text-soft)', lineHeight: 1.5 }}>{e.role}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', ...mono, fontSize: 11.5, color: 'var(--text-muted)' }}>{e.exemple}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>
          Le <strong>serial</strong> du SOA s’incrémente à chaque modification (AAAAMMJJnn) — sinon les secondaires ne rechargent pas.
        </div>
      </div>

      {/* Les fichiers d'exemple, entiers, à copier. */}
      <div style={groupe}>
        <div style={legende}>📄 Les fichiers, prêts à adapter</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {DNS_FICHIERS_EXEMPLE.map((f, i) => (
            <div key={f.nom}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                <code style={{ ...mono, fontWeight: 700, fontSize: 12.5 }}>{f.chemin}</code>
                {boutonCopier(f.contenu, 'f' + i)}
              </div>
              <div className="meta" style={{ fontSize: 11.5, marginBottom: 6 }}>{f.role}</div>
              <pre style={pre}><code>{f.contenu}</code></pre>
            </div>
          ))}
        </div>
        <div className="meta" style={{ fontSize: 11.5, marginTop: 10, lineHeight: 1.6 }}>
          Après édition : <code style={mono}>named-checkconf</code>, puis{' '}
          <code style={mono}>named-checkzone</code> sur chaque zone, et enfin{' '}
          <code style={mono}>systemctl reload named</code>. On vérifie <em>avant</em> de recharger — un fichier fautif laisse le serveur sans DNS.
        </div>
      </div>
    </div>
  );
}

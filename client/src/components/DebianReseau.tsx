/**
 * Configurateur d'adressage IP Debian — îlot React (data-block="debian-reseau").
 *
 * Il écrit `/etc/network/interfaces`, mais ce n'est pas là qu'il sert : écrire
 * ce fichier n'a jamais été difficile. Ce qui coûte une heure, ce sont les
 * fautes que la syntaxe ne signale pas — une passerelle hors du sous-réseau, une
 * adresse qui est celle du réseau, un `auto` oublié. Le fichier est valide, et
 * le réseau ne marche pas.
 *
 * L'outil vérifie donc pendant qu'on saisit, et dit ce que chaque faute
 * provoquera plutôt que ce qui est faux.
 */
import { useMemo, useState } from 'react';
import {
  CONFIG_VIDE, commandes, fichierHosts, fichierInterfaces, fichierResolv,
  plan, script, verifier, type Config, type Gravite,
} from '@/lib/debian-reseau';

const champ: React.CSSProperties = { padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 13.5, boxSizing: 'border-box', width: '100%' };
const mono: React.CSSProperties = { fontFamily: "ui-monospace,'Space Mono',SFMono-Regular,Menlo,Consolas,monospace" };
const groupe: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', background: 'var(--surface-2)', marginBottom: 14 };
const legende: React.CSSProperties = { fontWeight: 700, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const petit: React.CSSProperties = { padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'transparent', color: 'var(--text-soft)', fontWeight: 600, cursor: 'pointer', fontSize: 12 };
const pre: React.CSSProperties = { ...mono, background: 'var(--surface-3)', border: '1px solid var(--border)', borderLeft: '3px solid var(--accent)', borderRadius: 8, padding: '11px 13px', overflowX: 'auto', fontSize: 12, lineHeight: 1.55, margin: 0, whiteSpace: 'pre' };

const COULEUR: Record<Gravite, string> = { erreur: '#dc2626', alerte: '#d97706', conseil: 'var(--text-muted)' };
const SIGNE: Record<Gravite, string> = { erreur: '🚫', alerte: '⚠', conseil: '💡' };

/*
 * @id     tssr.atelier.debianReseauComp
 * @do     configurer_reseau_debian
 * @role   ui
 * @layer  ui
 * @human  Atelier : configuration guidée du réseau Debian.
 */
export function DebianReseau() {
  const [c, setC] = useState<Config>(CONFIG_VIDE);
  const [copie, setCopie] = useState('');
  // Le delai du filet : assez pour verifier a la main, assez court pour ne pas
  // rester bloque devant une console si la bascule a coupe la session.
  const [delai, setDelai] = useState(120);

  const maj = (p: Partial<Config>) => setC({ ...c, ...p });
  const soucis = useMemo(() => verifier(c), [c]);
  const p = useMemo(() => (c.methode === 'static' ? plan(c.adresse, c.cidr) : null), [c.adresse, c.cidr, c.methode]);
  const bloquant = soucis.some(s => s.gravite === 'erreur');

  const copier = (texte: string, id: string) => {
    navigator.clipboard?.writeText(texte).then(() => {
      setCopie(id);
      setTimeout(() => setCopie(''), 1400);
    }).catch(() => { /* presse-papiers refusé : le texte reste sélectionnable */ });
  };

  const telecharger = (texte: string, nom: string) => {
    const url = URL.createObjectURL(new Blob([texte], { type: 'text/x-shellscript' }));
    const a = document.createElement('a');
    a.href = url; a.download = nom; a.click();
    URL.revokeObjectURL(url);
  };

  const sortie = (titre: string, id: string, texte: string, sous?: string) => (
    <div style={groupe}>
      <div style={legende}>
        {titre}
        {sous && <span className="meta" style={{ fontSize: 11.5, fontWeight: 400 }}>{sous}</span>}
        <button type="button" style={{ ...petit, marginLeft: 'auto', borderColor: copie === id ? 'var(--accent)' : 'var(--border)', color: copie === id ? 'var(--accent)' : 'var(--text-soft)' }}
          onClick={() => copier(texte, id)}>{copie === id ? '✓ Copié' : 'Copier'}</button>
      </div>
      <pre style={pre}><code>{texte}</code></pre>
    </div>
  );

  return (
    <div className="outil-large">
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>🌐 Adressage IP — Debian</div>
        <span className="meta" style={{ fontSize: 11.5 }}>
          Écrire le fichier n’est pas le difficile — c’est de ne pas s’y tromper.
        </span>
      </div>

      <div style={groupe}>
        <div style={legende}>🖧 L’interface</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
          <label style={{ fontSize: 12 }}>Nom de l’interface<br />
            <input style={{ ...champ, ...mono }} value={c.iface} onChange={e => maj({ iface: e.target.value })} placeholder="ens18" />
          </label>
          <label style={{ fontSize: 12 }}>Montée au démarrage<br />
            <select style={champ} value={c.montage} onChange={e => maj({ montage: e.target.value as Config['montage'] })}>
              <option value="auto">auto — toujours (serveur)</option>
              <option value="allow-hotplug">allow-hotplug — à la détection</option>
              <option value="manuel">aucun — montage à la main</option>
            </select>
          </label>
          <label style={{ fontSize: 12 }}>Méthode<br />
            <select style={champ} value={c.methode} onChange={e => maj({ methode: e.target.value as Config['methode'] })}>
              <option value="static">static — adresse fixe</option>
              <option value="dhcp">dhcp — obtenue d’un serveur</option>
            </select>
          </label>
        </div>
        <div className="meta" style={{ fontSize: 11.5, marginTop: 6 }}>
          Le nom se lit avec <code>ip -br a</code> — ne le devine pas.
        </div>
      </div>

      {c.methode === 'static' && (
        <div style={groupe}>
          <div style={legende}>
            📍 L’adressage
            {p && <span className="meta" style={{ fontSize: 11.5, fontWeight: 400, ...mono }}>
              réseau {p.reseau}/{c.cidr} · masque {p.masque} · {p.hotes} hôtes · plage {p.premiere} → {p.derniere} · diffusion {p.diffusion}
            </span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10 }}>
            <label style={{ fontSize: 12 }}>Adresse<br />
              <input style={{ ...champ, ...mono }} value={c.adresse} onChange={e => maj({ adresse: e.target.value })} />
            </label>
            <label style={{ fontSize: 12 }}>Préfixe (CIDR)<br />
              <input type="number" min={1} max={32} style={{ ...champ, ...mono }} value={c.cidr}
                onChange={e => maj({ cidr: Number(e.target.value) || 24 })} />
            </label>
            <label style={{ fontSize: 12 }}>Passerelle<br />
              <input style={{ ...champ, ...mono }} value={c.passerelle} onChange={e => maj({ passerelle: e.target.value })} />
            </label>
            <label style={{ fontSize: 12 }}>MTU (facultatif)<br />
              <input style={{ ...champ, ...mono }} value={c.mtu} onChange={e => maj({ mtu: e.target.value })} placeholder="1500" />
            </label>
          </div>
        </div>
      )}

      <div style={groupe}>
        <div style={legende}>🔤 Noms</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
          <label style={{ fontSize: 12 }}>Serveurs DNS<br />
            <input style={{ ...champ, ...mono }} value={c.dns} onChange={e => maj({ dns: e.target.value })} placeholder="192.168.10.11 1.1.1.1" />
          </label>
          <label style={{ fontSize: 12 }}>Domaine de recherche<br />
            <input style={{ ...champ, ...mono }} value={c.domaine} onChange={e => maj({ domaine: e.target.value })} placeholder="miyukini.lan" />
          </label>
          <label style={{ fontSize: 12 }}>Nom de la machine<br />
            <input style={{ ...champ, ...mono }} value={c.hostname} onChange={e => maj({ hostname: e.target.value })} placeholder="srv-debian" />
          </label>
        </div>
        <label style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 12.5, cursor: 'pointer', marginTop: 10 }}>
          <input type="checkbox" checked={c.resolvconf} style={{ marginTop: 2 }} onChange={e => maj({ resolvconf: e.target.checked })} />
          <span>
            Le paquet <code>resolvconf</code> est installé
            <span className="meta" style={{ display: 'block', fontSize: 11.5 }}>
              Sans lui, <code>dns-nameservers</code> n’est lu par personne : la ligne est ignorée en silence.
              Le configurateur écrit alors <code>/etc/resolv.conf</code> directement.
            </span>
          </span>
        </label>
      </div>

      <details style={groupe}>
        <summary style={{ ...legende, marginBottom: 0, cursor: 'pointer' }}>➕ Adresses et routes supplémentaires</summary>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 10, marginTop: 10 }}>
          <label style={{ fontSize: 12 }}>Adresses en plus — une par ligne<br />
            <textarea rows={3} style={{ ...champ, ...mono, resize: 'vertical', fontSize: 12 }} value={c.adressesSup}
              onChange={e => maj({ adressesSup: e.target.value })} placeholder="192.168.10.21/24" />
          </label>
          <label style={{ fontSize: 12 }}>Routes statiques — une par ligne<br />
            <textarea rows={3} style={{ ...champ, ...mono, resize: 'vertical', fontSize: 12 }} value={c.routes}
              onChange={e => maj({ routes: e.target.value })} placeholder="10.0.0.0/8 via 192.168.10.253" />
          </label>
        </div>
        <div className="meta" style={{ fontSize: 11.5, marginTop: 6 }}>
          Chaque <code>up</code> reçoit son <code>down</code> : sans quoi l’adresse survit à un <code>ifdown</code>,
          et la configuration réelle diverge du fichier.
        </div>
      </details>

      {soucis.length > 0 && (
        <div style={{ ...groupe, borderColor: bloquant ? 'var(--danger, #dc2626)' : 'var(--border)' }}>
          <div style={{ ...legende, color: bloquant ? 'var(--danger, #dc2626)' : 'var(--text)' }}>
            {bloquant ? '🚫 À corriger avant d’appliquer' : '⚠ À vérifier'}
          </div>
          {soucis.map((s, i) => (
            <div key={i} style={{ marginTop: i ? 9 : 0, paddingLeft: 10, borderLeft: `2px solid ${COULEUR[s.gravite]}` }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: COULEUR[s.gravite] }}>{SIGNE[s.gravite]} {s.quoi}</div>
              <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{s.effet}</div>
            </div>
          ))}
        </div>
      )}

      {!soucis.length && (
        <div style={groupe}>
          <div className="meta" style={{ fontSize: 12.5, color: 'var(--ok, #059669)' }}>
            ✓ Adressage cohérent — passerelle dans le sous-réseau, adresse utilisable, interface montée au démarrage.
          </div>
        </div>
      )}

      {sortie('📄 /etc/network/interfaces', 'iface', fichierInterfaces(c))}
      {!c.resolvconf && c.dns.trim() && sortie('📄 /etc/resolv.conf', 'resolv', fichierResolv(c), 'puisque resolvconf n’est pas là pour l’écrire')}
      {c.hostname.trim() && sortie('📄 /etc/hosts', 'hosts', fichierHosts(c), 'la ligne 127.0.1.1 évite « sudo: unable to resolve host »')}
      <div style={groupe}>
        <div style={legende}>
          🧱 Le script d’application
          <span className="meta" style={{ fontSize: 11.5, fontWeight: 400 }}>
            avec retour arrière automatique — le « netplan try » que Debian n’a pas
          </span>
          <label style={{ fontSize: 11.5, marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
            filet
            <input type="number" min={30} max={600} step={30} value={delai} style={{ ...champ, ...mono, width: 76 }}
              onChange={e => setDelai(Math.max(30, Number(e.target.value) || 120))} />
            s
          </label>
          <button type="button" style={petit} onClick={() => telecharger(script(c, delai), 'configurer-reseau.sh')}>💾 .sh</button>
          <button type="button" style={{ ...petit, borderColor: copie === 'script' ? 'var(--accent)' : 'var(--border)', color: copie === 'script' ? 'var(--accent)' : 'var(--text-soft)' }}
            onClick={() => copier(script(c, delai), 'script')}>{copie === 'script' ? '✓ Copié' : 'Copier'}</button>
        </div>
        <div className="meta" style={{ fontSize: 11.5, marginBottom: 8 }}>
          Il arme le filet <strong>avant</strong> d’écrire quoi que ce soit : si la vérification échoue — ou si le
          script est interrompu — l’ancienne configuration revient toute seule au bout de {delai} secondes.
          C’est ce qui rend l’erreur survivable quand on travaille par SSH.
        </div>
        <pre style={pre}><code>{script(c, delai)}</code></pre>
        <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>
          <code>chmod +x configurer-reseau.sh</code> puis <code>sudo ./configurer-reseau.sh</code>.
          À relire avant de lancer : il réécrit trois fichiers système.
        </div>
      </div>

      {sortie('⌨️ Ou à la main, étape par étape', 'cmd', commandes(c), 'sauvegarder · vérifier · appliquer · contrôler')}

      <div className="meta" style={{ fontSize: 11.5 }}>
        En SSH, garde <strong>la console de l’hyperviseur ouverte</strong> pendant l’application : une erreur
        d’adressage coupe la session, et c’est le seul moyen de rentrer.
      </div>
    </div>
  );
}

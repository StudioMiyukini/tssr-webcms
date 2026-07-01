import { useMemo, useState } from 'react';

/**
 * Configurateur de script Active Directory.
 * Génère un script PowerShell (module ActiveDirectory) qui :
 *  1) crée une unité d'organisation,
 *  2) copie un utilisateur modèle (ex. administrateur) vers un nouvel utilisateur,
 *  3) désactive l'utilisateur source.
 * Îlot React hydraté via RichContent (data-block="ad-configurator").
 */

const fieldStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 4 };
const groupStyle: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', background: 'var(--surface-2)', marginBottom: 14 };
const legendStyle: React.CSSProperties = { fontWeight: 700, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 };
const rowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12 };
const btnStyle: React.CSSProperties = { padding: '8px 12px', border: '1px solid var(--accent)', borderRadius: 8, background: 'transparent', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' };

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const domainToDN = (d: string) => d.split('.').filter(Boolean).map(p => `DC=${p}`).join(',');

export function AdConfigurator() {
  const [domain, setDomain] = useState('miyukini.lan');
  const [ouName, setOuName] = useState('Direction');
  const [source, setSource] = useState('administrateur');
  const [prenom, setPrenom] = useState('Jean');
  const [nom, setNom] = useState('NGUYEN');
  const [loginManual, setLoginManual] = useState('');
  const [placeInOu, setPlaceInOu] = useState(true);
  const [disableSource, setDisableSource] = useState(true);
  const [copyGroups, setCopyGroups] = useState(true);
  const [copied, setCopied] = useState(false);
  // Verrou d'accès (dissuasif, côté navigateur)
  const [unlocked, setUnlocked] = useState(() => { try { return sessionStorage.getItem('vmcfg_ok') === '1'; } catch { return false; } });
  const [pwd, setPwd] = useState('');
  const [pwdErr, setPwdErr] = useState(false);
  const tryUnlock = () => {
    if (pwd === 'Takatoukiter31') { setUnlocked(true); setPwdErr(false); try { sessionStorage.setItem('vmcfg_ok', '1'); } catch { /* */ } }
    else setPwdErr(true);
  };

  const login = loginManual || `${slug(prenom)}.${slug(nom)}`;
  const displayName = `${prenom} ${nom}`.trim();
  const domainDN = domainToDN(domain);

  const script = useMemo(() => {
    const ouPath = placeInOu ? `OU=${ouName},${domainDN}` : `CN=Users,${domainDN}`;
    const L: string[] = [];
    L.push('#Requires -RunAsAdministrator');
    L.push('Import-Module ActiveDirectory');
    L.push('# ============================================================');
    L.push(`#  AD : UO '${ouName}' + copie de '${source}' vers '${login}' + desactivation de '${source}'`);
    L.push(`#  Domaine : ${domain}  (${domainDN})`);
    L.push('# ============================================================');
    L.push(`$Domain   = '${domain}'`);
    L.push(`$DomainDN = '${domainDN}'`);
    L.push(`$OUName   = '${ouName}'`);
    L.push(`$Source   = '${source}'`);
    L.push(`$OUPath   = '${ouPath}'`);
    L.push('');
    L.push('# 1) Creer l\'unite d\'organisation (si absente)');
    L.push('if (-not (Get-ADOrganizationalUnit -Filter "Name -eq \'$OUName\'" -SearchBase $DomainDN -ErrorAction SilentlyContinue)) {');
    L.push('    New-ADOrganizationalUnit -Name $OUName -Path $DomainDN -ProtectedFromAccidentalDeletion $false');
    L.push('    Write-Host "UO creee : $OUName"');
    L.push('} else { Write-Host "UO deja existante : $OUName" }');
    L.push('');
    L.push(`# 2) Copier '${source}' vers le nouvel utilisateur`);
    L.push('$Template = Get-ADUser -Identity $Source -Properties MemberOf');
    L.push('$Password = Read-Host -AsSecureString "Mot de passe du nouvel utilisateur"');
    L.push(`New-ADUser -Name "${displayName}" -GivenName "${prenom}" -Surname "${nom}" -DisplayName "${displayName}" -SamAccountName "${login}" -UserPrincipalName "${login}@$Domain" -Path $OUPath -AccountPassword $Password -Enabled $true -ChangePasswordAtLogon $false`);
    if (copyGroups) {
      L.push('# Recopier les groupes du modele');
      L.push(`foreach ($g in $Template.MemberOf) { Add-ADGroupMember -Identity $g -Members "${login}" }`);
    }
    L.push(`Write-Host "Utilisateur cree : ${login}@$Domain"`);
    if (disableSource) {
      L.push('');
      L.push(`# 3) Desactiver le compte '${source}'`);
      L.push('Disable-ADAccount -Identity $Source');
      L.push('Write-Host "Compte desactive : $Source"');
    }
    return L.join('\n');
  }, [domain, domainDN, ouName, source, prenom, nom, login, displayName, placeInOu, disableSource, copyGroups]);

  const copy = () => { navigator.clipboard?.writeText(script).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => {}); };

  if (!unlocked) {
    return (
      <div style={{ margin: '14px 0', maxWidth: 580, border: '1px solid var(--border)', borderRadius: 12, padding: '20px 22px', background: 'var(--surface-2)' }}>
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>🔒 Accès protégé</div>
        <aside className="pb-note pb-note-yellow" style={{ marginBottom: 14 }}>
          <p className="pb-note-title">⚠️ Outil réservé aux personnes qui maîtrisent</p>
          <p>Ce configurateur génère des scripts qui <strong>modifient l’annuaire Active Directory</strong> (création d’UO et de comptes, <strong>désactivation de l’administrateur</strong>). Une mauvaise utilisation peut <strong>bloquer l’accès au domaine</strong>. À n’utiliser que si tu maîtrises l’administration <strong>Active Directory</strong>, sur un environnement de test, après avoir un <strong>autre compte administrateur fonctionnel</strong>.</p>
        </aside>
        <label style={labelStyle}>Code d’accès</label>
        <div style={{ display: 'flex', gap: 8, maxWidth: 360 }}>
          <input type="password" style={fieldStyle} value={pwd} autoFocus
            onChange={e => { setPwd(e.target.value); setPwdErr(false); }}
            onKeyDown={e => { if (e.key === 'Enter') tryUnlock(); }} placeholder="Code d’accès" />
          <button type="button" style={btnStyle} onClick={tryUnlock}>Déverrouiller</button>
        </div>
        {pwdErr && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>Code incorrect.</div>}
      </div>
    );
  }

  return (
    <div style={{ margin: '14px 0' }}>
      <div style={groupStyle}>
        <div style={legendStyle}>🏢 Domaine & unité d’organisation</div>
        <div style={rowStyle}>
          <div>
            <label style={labelStyle}>Domaine</label>
            <input style={fieldStyle} value={domain} onChange={e => setDomain(e.target.value)} placeholder="miyukini.lan" />
          </div>
          <div>
            <label style={labelStyle}>Nom de l’UO à créer</label>
            <input style={fieldStyle} value={ouName} onChange={e => setOuName(e.target.value)} placeholder="Direction" />
          </div>
          <div>
            <label style={labelStyle}>DN du domaine (auto)</label>
            <input style={{ ...fieldStyle, fontFamily: 'ui-monospace,monospace' }} value={domainDN} readOnly />
          </div>
        </div>
      </div>

      <div style={groupStyle}>
        <div style={legendStyle}>👤 Copie d’utilisateur</div>
        <div style={rowStyle}>
          <div>
            <label style={labelStyle}>Utilisateur source (modèle)</label>
            <input style={fieldStyle} value={source} onChange={e => setSource(e.target.value)} placeholder="administrateur" />
          </div>
          <div>
            <label style={labelStyle}>Prénom</label>
            <input style={fieldStyle} value={prenom} onChange={e => setPrenom(e.target.value)} placeholder="Jean" />
          </div>
          <div>
            <label style={labelStyle}>Nom</label>
            <input style={fieldStyle} value={nom} onChange={e => setNom(e.target.value)} placeholder="NGUYEN" />
          </div>
          <div>
            <label style={labelStyle}>Identifiant (login)</label>
            <input style={fieldStyle} value={login} onChange={e => setLoginManual(e.target.value)} placeholder="jean.nguyen" />
          </div>
          <div>
            <label style={labelStyle}>UPN (auto)</label>
            <input style={{ ...fieldStyle, fontFamily: 'ui-monospace,monospace', color: 'var(--accent)', fontWeight: 700 }} value={`${login}@${domain}`} readOnly />
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, cursor: 'pointer' }}>
            <input type="checkbox" checked={placeInOu} onChange={e => setPlaceInOu(e.target.checked)} /> Placer le nouvel utilisateur dans l’UO
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, cursor: 'pointer' }}>
            <input type="checkbox" checked={copyGroups} onChange={e => setCopyGroups(e.target.checked)} /> Copier les groupes du modèle
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, cursor: 'pointer' }}>
            <input type="checkbox" checked={disableSource} onChange={e => setDisableSource(e.target.checked)} /> Désactiver l’utilisateur source
          </label>
        </div>
        <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>🔐 Le mot de passe du nouvel utilisateur est demandé à l’exécution (Read-Host), il n’apparaît pas dans le script.</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0 6px' }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>📜 Script généré (à exécuter sur le contrôleur de domaine)</div>
        <button onClick={copy} style={{ padding: '6px 14px', border: '1px solid var(--accent)', borderRadius: 8, background: copied ? 'var(--accent)' : 'transparent', color: copied ? '#fff' : 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
          {copied ? '✓ Copié' : 'Copier'}
        </button>
      </div>
      <pre style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', overflowX: 'auto', fontSize: 12.5, lineHeight: 1.55, margin: 0 }}><code>{script}</code></pre>
    </div>
  );
}

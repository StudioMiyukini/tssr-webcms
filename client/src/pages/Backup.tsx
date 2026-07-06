import { useRef, useState } from 'react';
import { useToast } from '@/lib/toast';

/** Sauvegarde & export du site (back-office) : télécharger un .zip (base + médias) et le réimporter. */
export function BackupPage() {
  const { push } = useToast();
  const [busy, setBusy] = useState<'' | 'export' | 'import'>('');
  const fileRef = useRef<HTMLInputElement>(null);

  const onExport = async () => {
    setBusy('export');
    try {
      const res = await fetch('/api/admin/export', { credentials: 'include' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({} as any))).error || `Échec (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `tssr-site-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      push('Export téléchargé.', 'success');
    } catch (e) { push(e instanceof Error ? e.message : 'Échec de l’export.', 'error'); }
    finally { setBusy(''); }
  };

  const onImport = async (file: File) => {
    if (!window.confirm('Importer ce fichier va REMPLACER le contenu actuel du site (pages, menus, réglages, médias). Continuer ?')) return;
    setBusy('import');
    try {
      const res = await fetch('/api/admin/import', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/zip' }, body: file });
      const j = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(j.error || `Échec (${res.status})`);
      push(`Import réussi : ${j.tables} tables, ${j.rows} lignes, ${j.uploads ?? 0} média(s). Rechargement…`, 'success');
      setTimeout(() => location.reload(), 1600);
    } catch (e) { push(e instanceof Error ? e.message : 'Échec de l’import.', 'error'); }
    finally { setBusy(''); if (fileRef.current) fileRef.current.value = ''; }
  };

  return (
    <>
      <div className="topbar-row">
        <div><h1>Sauvegarde &amp; export</h1><p>Télécharge tout le site (contenu + médias) ou réimporte une sauvegarde.</p></div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>⬇️ Exporter le site</h2>
        <p className="meta">Génère un <strong>.zip</strong> contenant la base de contenu (<code>cms.sqlite</code>) et tous les médias (<code>uploads</code>). À conserver comme sauvegarde ou à importer sur un autre poste.</p>
        <button className="btn" onClick={onExport} disabled={busy !== ''}>{busy === 'export' ? 'Préparation…' : '⬇️ Télécharger l’export (.zip)'}</button>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>⬆️ Importer une sauvegarde</h2>
        <p className="meta">Envoie un <strong>.zip</strong> exporté (ce site ou un autre). Le contenu et les médias <strong>remplacent</strong> ceux en place. Ta session d’administration est conservée (la table des sessions n’est pas écrasée). Une sauvegarde de l’ancienne base n’est <em>pas</em> automatique côté serveur — <strong>exporte d’abord</strong> par sécurité.</p>
        <input ref={fileRef} type="file" accept=".zip,application/zip" hidden onChange={e => { const f = e.target.files?.[0]; if (f) onImport(f); }} />
        <button className="btn secondary" onClick={() => fileRef.current?.click()} disabled={busy !== ''}>{busy === 'import' ? 'Import en cours…' : '⬆️ Choisir un fichier .zip à importer'}</button>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>💻 Récupérer le site en local (hors-ligne)</h2>
        <p className="meta">Depuis un autre poste, télécharge l’export puis lance‑le hors‑ligne. En ligne de commande (le poste doit avoir accès à ce serveur) :</p>
        <pre style={{ background: 'var(--surface-2, #f4f4f5)', border: '1px solid var(--border, #e4e4e7)', borderRadius: 8, padding: '12px 14px', overflowX: 'auto', fontSize: 12.5, whiteSpace: 'pre-wrap' }}><code>{`# 1) S'authentifier (compte admin) et garder le cookie
curl -c cookies.txt -X POST https://tssr.miyukini.com/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d "{\\"username\\":\\"admin\\",\\"password\\":\\"VOTRE_MDP\\"}"

# 2) Télécharger l'export complet
curl -b cookies.txt https://tssr.miyukini.com/api/admin/export -o tssr-site.zip`}</code></pre>
        <p className="meta">Puis dézippe et importe le <code>.zip</code> dans une instance locale (<code>node scripts/import-site.mjs tssr-site.zip</code>), ou utilise l’export portable autonome (<code>npm run export</code>) et son lanceur <code>Lancer-le-site.bat</code>.</p>
      </div>
    </>
  );
}

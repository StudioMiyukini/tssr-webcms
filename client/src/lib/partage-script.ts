/**
 * Dépose un script généré sur le serveur et rend la ligne à taper dans la VM
 * pour le récupérer : les VM du labo n'ont pas de navigateur, et coller trois
 * cents lignes dans une console passe mal. Sept jours de validité.
 */
export type Depot = { id: string; url: string; expireLe: number };

export async function deposerScript(nom: string, contenu: string): Promise<Depot> {
  const r = await fetch('/api/public/scripts-partages', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
    body: JSON.stringify({ nom, contenu }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Dépôt refusé (${r.status})`);
  return { id: j.id, url: `${window.location.origin}${j.chemin}`, expireLe: j.expire_le };
}

/** Les lignes à taper dans la VM (ou sur le poste) selon le type de fichier. */
export function lignesRecuperation(url: string, fichier: string, sudo = true): string {
  const court = fichier.replace(/^.*\//, '');
  if (fichier.endsWith('.ps1')) {
    return `Invoke-WebRequest -Uri ${url} -OutFile ${court}\n.\${court}`;
  }
  const lancer = sudo ? `sudo bash ~/${court}` : `bash ~/${court}`;
  return `curl -fsSL ${url} -o ~/${court} && ${lancer}\n# ou, sans curl :\nwget -qO ~/${court} ${url} && ${lancer}`;
}

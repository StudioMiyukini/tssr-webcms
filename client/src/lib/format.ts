/*
 * @id     tssr.webFormatPrice
 * @do     formater_prix_euros
 * @role   ui
 * @layer  outil
 * @human  Met en forme un montant en centimes en prix en euros, côté client.
 */
export function formatPriceEUR(cents: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format((cents || 0) / 100);
}

/*
 * @id     tssr.webFormatOrderStatus
 * @do     libeller_statut_commande
 * @role   ui
 * @layer  outil
 * @human  Traduit un statut de commande en libellé lisible.
 */
export function formatOrderStatus(status: string): string {
  const labels: Record<string, string> = {
    pending: 'En attente',
    processing: 'En préparation',
    completed: 'Terminée',
    cancelled: 'Annulée',
    refunded: 'Remboursée',
  };
  return labels[status] || status;
}

/*
 * @id     tssr.webFormatDate
 * @do     formater_date
 * @role   ui
 * @layer  outil
 * @human  Met en forme une date en texte lisible en français.
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '';
  try { return new Date(dateString).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return dateString; }
}

const DATE_OPTS: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
const TIME_OPTS: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };

/** Plage de date/heure lisible d'un événement (gère journée entière et fin optionnelle). */
/*
 * @id     tssr.webFormatEventDate
 * @do     formater_date_evenement
 * @role   ui
 * @layer  outil
 * @human  Met en forme la plage de dates d'un événement (journée entière incluse).
 */
export function formatEventDate(start: string, end?: string, allDay?: boolean): string {
  if (!start) return '';
  const s = new Date(start);
  if (isNaN(s.getTime())) return start;
  const sd = s.toLocaleDateString('fr-FR', DATE_OPTS);
  const e = end ? new Date(end) : null;
  const eValid = e && !isNaN(e.getTime());
  if (allDay) {
    if (eValid && e!.toDateString() !== s.toDateString()) return `${sd} → ${e!.toLocaleDateString('fr-FR', DATE_OPTS)}`;
    return sd;
  }
  const st = s.toLocaleTimeString('fr-FR', TIME_OPTS);
  if (eValid) {
    if (e!.toDateString() === s.toDateString()) return `${sd} · ${st} – ${e!.toLocaleTimeString('fr-FR', TIME_OPTS)}`;
    return `${sd} ${st} → ${e!.toLocaleDateString('fr-FR', DATE_OPTS)} ${e!.toLocaleTimeString('fr-FR', TIME_OPTS)}`;
  }
  return `${sd} · ${st}`;
}

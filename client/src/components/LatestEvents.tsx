import { usePublicEvents } from '@/api/public';
import { formatEventDate } from '@/lib/format';

/** Îlot dynamique : prochains événements de l'agenda (liens en <a> car hors contexte router). */
export function LatestEvents({ count, title }: { count: number; title: string }) {
  const events = usePublicEvents();
  const now = Date.now();
  const upcoming = (events.data ?? [])
    .filter(ev => new Date(ev.end_at || ev.start_at).getTime() >= now)
    .slice(0, count);
  if (!upcoming.length) return null;
  return (
    <div className="pb-latest">
      {title && <h2>{title}</h2>}
      <div className="event-list">
        {upcoming.map(ev => (
          <article key={ev.id} className="event-card">
            {ev.image_url && <a className="event-thumb" href={`/agenda/${ev.slug}`}><img src={ev.image_url} alt={ev.title} loading="lazy" /></a>}
            <div className="event-body">
              <p className="event-date">{formatEventDate(ev.start_at, ev.end_at, !!ev.all_day)}</p>
              <h3 className="event-title"><a href={`/agenda/${ev.slug}`}>{ev.title}</a></h3>
              {ev.location && <p className="event-loc">📍 {ev.location}</p>}
              {ev.description && <p className="meta">{ev.description.slice(0, 160)}{ev.description.length > 160 ? '…' : ''}</p>}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

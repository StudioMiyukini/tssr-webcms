import { useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { usePublicEvents, usePublicEvent } from '@/api/public';
import type { EventRecord } from '@/api/hooks';
import { formatEventDate } from '@/lib/format';

function isUpcoming(ev: EventRecord): boolean {
  const ref = ev.end_at || ev.start_at;
  const d = new Date(ref);
  return isNaN(d.getTime()) ? true : d.getTime() >= Date.now();
}

function EventCard({ ev }: { ev: EventRecord }) {
  return (
    <article className="event-card">
      {ev.image_url && <Link to="/agenda/$slug" params={{ slug: ev.slug }} className="event-thumb"><img src={ev.image_url} alt={ev.title} loading="lazy" /></Link>}
      <div className="event-body">
        <p className="event-date">{formatEventDate(ev.start_at, ev.end_at, !!ev.all_day)}</p>
        <h3 className="event-title"><Link to="/agenda/$slug" params={{ slug: ev.slug }}>{ev.title}</Link></h3>
        {ev.location && <p className="event-loc">📍 {ev.location}</p>}
        {ev.description && <p className="meta">{ev.description.slice(0, 160)}{ev.description.length > 160 ? '…' : ''}</p>}
      </div>
    </article>
  );
}

export function AgendaPage() {
  const q = usePublicEvents();
  const [showPast, setShowPast] = useState(false);

  if (q.isLoading) return <div className="loading">Chargement…</div>;
  if (q.isError) return <div className="empty">Agenda indisponible.</div>;
  const all = q.data ?? [];
  const upcoming = all.filter(isUpcoming);
  const past = all.filter(e => !isUpcoming(e)).reverse();

  return (
    <section>
      <div className="topbar-row"><h1>Agenda</h1>{past.length > 0 && (
        <button className="btn secondary" type="button" onClick={() => setShowPast(p => !p)}>{showPast ? 'Voir les événements à venir' : 'Voir les événements passés'}</button>
      )}</div>
      {!showPast && (
        upcoming.length === 0
          ? <div className="empty">Aucun événement à venir pour le moment.</div>
          : <div className="event-list">{upcoming.map(ev => <EventCard key={ev.id} ev={ev} />)}</div>
      )}
      {showPast && (
        past.length === 0
          ? <div className="empty">Aucun événement passé.</div>
          : <div className="event-list">{past.map(ev => <EventCard key={ev.id} ev={ev} />)}</div>
      )}
    </section>
  );
}

export function EventViewPage() {
  const { slug } = useParams({ strict: false }) as { slug: string };
  const q = usePublicEvent(slug);

  if (q.isLoading) return <div className="loading">Chargement…</div>;
  if (q.isError || !q.data) return <div className="empty">Cet événement n'existe pas ou n'est plus disponible.</div>;
  const ev = q.data;

  return (
    <article className="card rich" style={{ maxWidth: 760, margin: '0 auto' }}>
      <p className="meta"><Link to="/agenda">← Agenda</Link></p>
      {ev.image_url && <p><img src={ev.image_url} alt={ev.title} style={{ width: '100%', borderRadius: 10 }} /></p>}
      <h1>{ev.title}</h1>
      <p className="event-date">{formatEventDate(ev.start_at, ev.end_at, !!ev.all_day)}</p>
      {ev.location && <p className="event-loc">📍 {ev.location}</p>}
      {ev.description && <p style={{ whiteSpace: 'pre-line' }}>{ev.description}</p>}
      {ev.url && <p><a className="btn" href={ev.url} target="_blank" rel="noopener noreferrer">En savoir plus / s'inscrire</a></p>}
    </article>
  );
}

import { usePublicPlannings } from '@/api/public';
import { PlanningTable } from '@/components/PlanningTable';

export function PlanningPublicPage() {
  const list = usePublicPlannings();
  if (list.isLoading) return <div className="loading">Chargement…</div>;
  if (list.isError) return <div className="empty">Planning indisponible.</div>;
  const items = list.data ?? [];
  return (
    <>
      <div className="topbar-row"><h1>Planning</h1></div>
      {items.length === 0
        ? <div className="empty">Aucun planning publié pour le moment.</div>
        : <div className="planning-list">{items.map(p => <PlanningTable key={p.id} planning={p} />)}</div>}
    </>
  );
}

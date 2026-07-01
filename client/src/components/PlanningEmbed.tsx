import { usePublicPlanning, usePublicPlannings } from '@/api/public';
import { PlanningTable } from './PlanningTable';

/** Îlot dynamique : affiche un planning précis (par slug) ou tous les plannings publiés. */
export function PlanningEmbed({ slug }: { slug: string }) {
  return slug ? <PlanningOne slug={slug} /> : <PlanningAll />;
}

function PlanningOne({ slug }: { slug: string }) {
  const q = usePublicPlanning(slug);
  if (!q.data) return null;
  return <PlanningTable planning={q.data} />;
}

function PlanningAll() {
  const q = usePublicPlannings();
  const items = q.data ?? [];
  if (!items.length) return null;
  return <div className="planning-list">{items.map(p => <PlanningTable key={p.id} planning={p} />)}</div>;
}
